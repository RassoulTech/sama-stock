import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { customers, products, saleItems, sales } from "@/db/schema";
import { clampSaleDate, computeSyncFlags } from "@/lib/domain/offline";
import { roundQty } from "@/lib/domain/stock";
import { unitAllowsDecimals } from "@/lib/format";
import type { OfflineSaleInput } from "@/lib/offline/schema";
import { lineTotal, saleTotals, unexpectedPriceChange } from "@/lib/offline/sale";
import type { SyncResult } from "@/lib/offline/types";
import { ActionError } from "../action";
import { contextForBusiness, type SessionUser } from "../context";
import { nextNumber } from "./numbering";
import { applyStockMovement, lockStock, reservedQuantities } from "./stock";

/** Vente déjà enregistrée avec cet identifiant de téléphone (anti-doublon). */
export async function findSaleByClientRef(dbOrTx: DbOrTx, businessId: string, clientRef: string) {
  const [row] = await dbOrTx
    .select({ id: sales.id, number: sales.number })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.clientRef, clientRef)));
  return row ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * Enregistre une vente faite sans internet. Elle n'est jamais refusée pour manque de stock : l'argent est déjà
 * encaissé. Le problème est signalé au propriétaire (`sync_flags`).
 */
export async function recordOfflineSale(user: SessionUser, input: OfflineSaleInput, now = new Date()): Promise<SyncResult> {
  const clientRef = input.clientRef;
  const refused = (error: string): SyncResult => ({ clientRef, status: "refused", error });

  const ctx = await contextForBusiness(user, input.businessId, input.locationId);
  if (!ctx) return refused("Ce commerce ou cette boutique n'est plus accessible avec votre compte.");
  if (!ctx.can("sales.create")) return refused("Vous n'avez plus le droit de vendre dans ce commerce.");
  if (!ctx.business.modulePos) return refused("La caisse a été désactivée pour ce commerce.");
  if (ctx.plan.status === "suspended") return { clientRef, status: "retry", error: "Commerce suspendu : contactez Sama Stock." };

  const createdAt = clampSaleDate(new Date(input.createdAt), now, ctx.business.createdAt);
  if (ctx.plan.readOnly && !(ctx.plan.endsAt && createdAt.getTime() <= ctx.plan.endsAt.getTime())) {
    return refused("La formule était expirée au moment de la vente. Renouvelez-la pour envoyer cette vente.");
  }
  const businessId = ctx.business.id;
  const locationId = ctx.location.id;

  try {
    const sale = await db.transaction(async (tx) => {
      const existing = await findSaleByClientRef(tx, businessId, clientRef);
      if (existing) return existing;

      // Regroupe les lignes d'un même produit ; le prix est celui montré au client
      const merged = new Map<string, { quantity: number; unitPrice: number; negotiated: boolean }>();
      for (const i of input.items) {
        const prev = merged.get(i.productId);
        merged.set(i.productId, {
          quantity: roundQty((prev?.quantity ?? 0) + i.quantity),
          unitPrice: i.unitPrice,
          negotiated: Boolean(prev?.negotiated || i.negotiated),
        });
      }
      const ids = [...merged.keys()];
      const rows = await tx
        .select({ id: products.id, name: products.name, unit: products.unit, salePrice: products.salePrice, costPrice: products.costPrice })
        .from(products)
        .where(and(eq(products.businessId, businessId), inArray(products.id, ids)));
      if (rows.length !== ids.length) throw new ActionError("Un des produits vendus a été supprimé.");

      const lines = rows.map((p) => {
        const { quantity, unitPrice } = merged.get(p.id)!;
        if (!unitAllowsDecimals(p.unit) && !Number.isInteger(quantity)) {
          throw new ActionError(`« ${p.name} » se vend en unités entières.`);
        }
        return { productId: p.id, name: p.name, unit: p.unit, quantity, unitPrice, unitCost: p.costPrice, lineTotal: lineTotal(quantity, unitPrice) };
      });
      const priceChanged = unexpectedPriceChange(
        [...merged.entries()].map(([productId, m]) => ({ productId, ...m })),
        new Map(rows.map((p) => [p.id, p.salePrice])),
      );
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      if (input.discount > subtotal) throw new ActionError("La remise dépasse le montant du panier.");
      const { total, amountPaid } = saleTotals(lines, input.discount, input.paymentMethod, input.amountReceived);

      let customerId: string | null = null;
      let customerMissing = false;
      if (input.customerId) {
        const [c] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.id, input.customerId), eq(customers.businessId, businessId)));
        if (c) customerId = c.id;
        else customerMissing = true;
      }

      await lockStock(tx, businessId, locationId, ids);
      const [row] = await tx
        .insert(sales)
        .values({
          businessId,
          locationId,
          number: await nextNumber(tx, businessId, "sale"),
          kind: "sale",
          channel: "boutique",
          status: "completed",
          customerId,
          userId: user.id,
          subtotal,
          discount: input.discount,
          total,
          amountPaid,
          paymentMethod: input.paymentMethod,
          createdAt,
          completedAt: createdAt,
          clientRef,
          offlineSyncedAt: now,
        })
        .returning({ id: sales.id, number: sales.number });
      await tx.insert(saleItems).values(lines.map((l) => ({ saleId: row!.id, ...l })));

      // Disponible = stock physique moins les commandes réservées : il manque des articles s'il passe sous zéro
      const reserved = await reservedQuantities(tx, businessId, locationId, ids);
      let negativeStock = false;
      for (const l of lines) {
        const left = await applyStockMovement(tx, {
          businessId,
          locationId,
          productId: l.productId,
          quantity: -l.quantity,
          type: "sale",
          refType: "sale",
          refId: row!.id,
          unitCost: l.unitCost,
          userId: user.id,
        });
        if (roundQty(left - (reserved.get(l.productId) ?? 0)) < 0) negativeStock = true;
      }
      const flags = computeSyncFlags({ negativeStock, priceChanged, customerMissing, creditWithoutCustomer: amountPaid < total && !customerId });
      if (flags.length > 0) await tx.update(sales).set({ syncFlags: flags }).where(eq(sales.id, row!.id));
      return row!;
    });
    return { clientRef, status: "ok", id: sale.id, number: sale.number };
  } catch (error) {
    if (error instanceof ActionError) return refused(error.message);
    if (isUniqueViolation(error)) {
      const existing = await findSaleByClientRef(db, businessId, clientRef);
      if (existing) return { clientRef, status: "ok", id: existing.id, number: existing.number };
    }
    console.error("[hors-ligne]", error);
    return { clientRef, status: "retry", error: "Erreur du serveur : nouvel essai dans un instant." };
  }
}

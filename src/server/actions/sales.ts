"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { customerPayments, notifications, sales, stockMovements } from "@/db/schema";
import { saleCancelMessage } from "@/lib/domain/notifications";
import { SALE_METHODS } from "@/lib/domain/sales";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";
import { notify } from "../services/notifications";
import { findSaleByClientRef } from "../services/offline-sales";
import { priceAndReserve } from "../services/sale-lines";
import { cancelShopSale, recordShopSale } from "../services/shop-sale";

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().positive("Quantité invalide.").max(10_000_000),
        /** Prix négocié avec le client à la caisse ; sans lui, c'est le prix du produit. */
        unitPrice: z.coerce.number().int("Prix en FCFA entiers.").min(0, "Prix invalide.").max(1_000_000_000).optional(),
      }),
    )
    .min(1, "Le panier est vide.")
    .max(200),
  discount: z.coerce.number().int().min(0, "Remise invalide.").default(0),
  customerId: z.string().nullable().optional(),
  paymentMethod: z.enum(SALE_METHODS),
  amountReceived: z.coerce.number().int().min(0).default(0),
  note: z.string().trim().max(300).optional().default(""),
  /** Identifiant créé par le téléphone : la même vente renvoyée n'est jamais enregistrée deux fois. */
  clientRef: z.uuid().optional(),
});

export async function createSale(input: z.input<typeof saleSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.create");
    if (!ctx.business.modulePos) throw new ActionError("La caisse n'est pas activée pour ce commerce.");
    const data = parse(saleSchema, input);

    const id = await db.transaction(async (tx) => {
      // Même vente renvoyée (réponse perdue pendant une coupure) : on renvoie celle qui existe déjà
      if (data.clientRef) {
        const existing = await findSaleByClientRef(tx, ctx.business.id, data.clientRef);
        if (existing) return existing.id;
      }
      const negotiated = new Map(data.items.flatMap((i) => (i.unitPrice === undefined ? [] : [[i.productId, i.unitPrice] as const])));
      const lines = await priceAndReserve(tx, ctx, data.items, { prices: negotiated });
      const sale = await recordShopSale(tx, ctx, {
        lines,
        discount: data.discount,
        customerId: data.customerId,
        paymentMethod: data.paymentMethod,
        amountReceived: data.amountReceived,
        note: data.note,
        clientRef: data.clientRef,
      });
      return sale.id;
    });

    revalidatePath("/", "layout");
    return { id };
  });
}

export async function cancelSale(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.cancel");

    await db.transaction(async (tx) => {
      const sale = await cancelShopSale(tx, ctx, id);
      await notify(tx, ctx, saleCancelMessage({ id: sale.id, number: sale.number, total: sale.total, actorName: ctx.user.name }));
    });

    revalidatePath("/", "layout");
    return null;
  });
}

/**
 * Corrige une vente : dans la même transaction, l'ancienne est annulée (stock remis) et la nouvelle, refaite à la
 * caisse avec le même panier modifié, est enregistrée en la remplaçant.
 */
export async function correctSale(id: string, input: z.input<typeof saleSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.cancel");
    if (!ctx.can("sales.create")) throw new ActionError("Vous n'avez pas accès à cette action.");
    if (!ctx.business.modulePos) throw new ActionError("La caisse n'est pas activée pour ce commerce.");
    const data = parse(saleSchema, input);

    const replacement = await db.transaction(async (tx) => {
      const old = await cancelShopSale(tx, ctx, id, (sale) => {
        if (sale.locationId !== ctx.location.id) {
          const where = ctx.locations.find((l) => l.id === sale.locationId)?.name ?? "une autre boutique";
          throw new ActionError(`Cette vente a été faite à ${where} : passez sur cette boutique pour la corriger.`);
        }
        if (sale.deliveryFee > 0) {
          throw new ActionError("Cette vente a des frais de livraison : annulez-la, puis refaites-la depuis son devis.");
        }
      });
      const negotiated = new Map(data.items.flatMap((i) => (i.unitPrice === undefined ? [] : [[i.productId, i.unitPrice] as const])));
      const lines = await priceAndReserve(tx, ctx, data.items, { prices: negotiated });
      const sale = await recordShopSale(tx, ctx, {
        lines,
        discount: data.discount,
        customerId: data.customerId,
        paymentMethod: data.paymentMethod,
        amountReceived: data.amountReceived,
        note: data.note || old.note,
        replacesId: old.id,
        keepPaid: old.amountPaid,
      });
      // Les remboursements imputés à l'ancienne vente passent sur la nouvelle (pour pouvoir encore les annuler)
      await tx.execute(sql`
        update ${customerPayments}
        set allocations = (
          select jsonb_agg(case when e->>'saleId' = ${old.id} then jsonb_set(e, '{saleId}', to_jsonb(${sale.id}::text)) else e end)
          from jsonb_array_elements(${customerPayments.allocations}) e
        )
        where ${customerPayments.businessId} = ${ctx.business.id}
          and ${customerPayments.allocations} @> ${JSON.stringify([{ saleId: old.id }])}::jsonb
      `);
      await notify(tx, ctx, saleCancelMessage({ id: old.id, number: old.number, total: old.total, actorName: ctx.user.name, replacement: sale }));
      return sale;
    });

    revalidatePath("/", "layout");
    return { id: replacement.id };
  });
}

/**
 * Efface pour de bon une vente déjà annulée (propriétaire seulement) : la vente, ses lignes, ses mouvements de stock
 * (la sortie et le retour, qui s'annulent) et ses notifications. Une facture annulée reste, sans lien vers la vente.
 */
export async function deleteSale(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.delete");

    await db.transaction(async (tx) => {
      const [sale] = await tx
        .select({ id: sales.id, status: sales.status })
        .from(sales)
        .where(and(eq(sales.id, id), eq(sales.businessId, ctx.business.id), eq(sales.kind, "sale")))
        .for("update");
      if (!sale) throw new ActionError("Vente introuvable.");
      if (sale.status !== "cancelled") throw new ActionError("Annulez d'abord la vente : seule une vente annulée peut être supprimée.");

      await tx
        .delete(stockMovements)
        .where(and(eq(stockMovements.businessId, ctx.business.id), eq(stockMovements.refType, "sale"), eq(stockMovements.refId, id)));
      await tx
        .delete(notifications)
        .where(and(eq(notifications.businessId, ctx.business.id), eq(notifications.href, `/ventes/${id}`)));
      await tx.delete(sales).where(eq(sales.id, id));
    });

    revalidatePath("/", "layout");
    return null;
  });
}

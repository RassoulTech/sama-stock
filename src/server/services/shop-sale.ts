import "server-only";
import { and, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { saleItems, sales } from "@/db/schema";
import { saleMessage } from "@/lib/domain/notifications";
import type { SaleMethod } from "@/lib/domain/sales";
import { ActionError } from "../action";
import type { BusinessContext } from "../context";
import { cancelInvoicesOfSale } from "./documents";
import { notify, watchStock } from "./notifications";
import { nextNumber } from "./numbering";
import { assertCustomer, type PricedLine } from "./sale-lines";
import { applyStockMovement } from "./stock";

/**
 * Enregistre une vente en boutique déjà chiffrée (lignes verrouillées par priceAndReserve) : numéro, paiement,
 * lignes et sortie de stock. Utilisé par la caisse et par la transformation d'un devis.
 */
export async function recordShopSale(
  tx: Tx,
  ctx: BusinessContext,
  input: {
    lines: PricedLine[];
    discount: number;
    deliveryFee?: number;
    customerId: string | null | undefined;
    paymentMethod: SaleMethod;
    amountReceived: number;
    note?: string | null;
    clientRef?: string | null;
    /** Correction : la vente annulée que celle-ci remplace (la notification « vente corrigée » est faite à part). */
    replacesId?: string | null;
    /** Correction d'une vente à crédit : ce que le client avait déjà remboursé reste payé. */
    keepPaid?: number;
  },
): Promise<{ id: string; number: string }> {
  const subtotal = input.lines.reduce((s, l) => s + l.lineTotal, 0);
  if (input.discount > subtotal) throw new ActionError("La remise dépasse le montant du panier.");
  const deliveryFee = input.deliveryFee ?? 0;
  const total = subtotal - input.discount + deliveryFee;
  const amountPaid = Math.min(input.paymentMethod === "credit" ? (input.keepPaid ?? 0) : input.amountReceived, total);

  const customerId = await assertCustomer(tx, ctx.business.id, input.customerId);
  if (amountPaid < total && !customerId) {
    throw new ActionError("Choisissez le client : une vente à crédit ou un paiement partiel doit être rattaché à un client.");
  }

  const stockAlerts = await watchStock(tx, ctx, input.lines.map((l) => l.productId));
  const now = new Date();
  const [sale] = await tx
    .insert(sales)
    .values({
      businessId: ctx.business.id,
      locationId: ctx.location.id,
      number: await nextNumber(tx, ctx.business.id, "sale"),
      kind: "sale",
      channel: "boutique",
      status: "completed",
      customerId,
      userId: ctx.user.id,
      subtotal,
      discount: input.discount,
      deliveryFee,
      total,
      amountPaid,
      paymentMethod: input.paymentMethod,
      note: input.note || null,
      createdAt: now,
      completedAt: now,
      clientRef: input.clientRef ?? null,
      replacesId: input.replacesId ?? null,
    })
    .returning({ id: sales.id, number: sales.number });

  await tx.insert(saleItems).values(input.lines.map((l) => ({ saleId: sale!.id, ...l })));
  for (const l of input.lines) {
    await applyStockMovement(tx, {
      businessId: ctx.business.id,
      locationId: ctx.location.id,
      productId: l.productId,
      quantity: -l.quantity,
      type: "sale",
      refType: "sale",
      refId: sale!.id,
      unitCost: l.unitCost,
      userId: ctx.user.id,
    });
  }
  await stockAlerts();
  if (!input.replacesId) {
    await notify(tx, ctx, saleMessage({ id: sale!.id, number: sale!.number, total, itemCount: input.lines.length, actorName: ctx.user.name }));
  }
  return sale!;
}

export type ShopSale = typeof sales.$inferSelect;

/**
 * Annule une vente en boutique : les produits reviennent en stock, la facture émise est annulée, on garde qui a
 * annulé. `check` peut refuser la vente (verrouillée) avant tout changement. Renvoie la vente telle qu'elle était.
 */
export async function cancelShopSale(tx: Tx, ctx: BusinessContext, id: string, check?: (sale: ShopSale) => void): Promise<ShopSale> {
  const [sale] = await tx
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.businessId, ctx.business.id), eq(sales.kind, "sale")))
    .for("update");
  if (!sale) throw new ActionError("Vente introuvable.");
  if (sale.status !== "completed") throw new ActionError("Cette vente est déjà annulée.");
  check?.(sale);

  await tx.update(sales).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: ctx.user.id }).where(eq(sales.id, id));
  await cancelInvoicesOfSale(tx, id);
  const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, id));
  for (const item of items) {
    if (!item.productId) continue;
    await applyStockMovement(tx, {
      businessId: ctx.business.id,
      locationId: sale.locationId,
      productId: item.productId,
      quantity: item.quantity,
      type: "sale_cancel",
      refType: "sale",
      refId: id,
      unitCost: item.unitCost,
      userId: ctx.user.id,
    });
  }
  return sale;
}

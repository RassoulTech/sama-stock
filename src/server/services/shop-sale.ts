import "server-only";
import type { Tx } from "@/db";
import { saleItems, sales } from "@/db/schema";
import { saleMessage } from "@/lib/domain/notifications";
import type { SaleMethod } from "@/lib/domain/sales";
import { ActionError } from "../action";
import type { BusinessContext } from "../context";
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
  },
): Promise<string> {
  const subtotal = input.lines.reduce((s, l) => s + l.lineTotal, 0);
  if (input.discount > subtotal) throw new ActionError("La remise dépasse le montant du panier.");
  const deliveryFee = input.deliveryFee ?? 0;
  const total = subtotal - input.discount + deliveryFee;
  const amountPaid = input.paymentMethod === "credit" ? 0 : Math.min(input.amountReceived, total);

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
  await notify(tx, ctx, saleMessage({ id: sale!.id, number: sale!.number, total, itemCount: input.lines.length, actorName: ctx.user.name }));
  return sale!.id;
}

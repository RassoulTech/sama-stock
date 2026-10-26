"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { saleItems, sales } from "@/db/schema";
import { formatFCFA, formatQty } from "@/lib/format";
import { canTransition, isOrderStatus, ORDER_STATUS_LABELS, ORDER_STATUSES, orderStockEffect } from "@/lib/domain/orders";
import { ORDER_CHANNELS, PAYING_METHODS } from "@/lib/domain/sales";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";
import { cancelInvoicesOfSale } from "../services/documents";
import { nextNumber } from "../services/numbering";
import { assertCustomer, priceAndReserve } from "../services/sale-lines";
import { applyStockMovement, lockStock } from "../services/stock";

const orderSchema = z.object({
  customerId: z.string().min(1, "Choisissez le client de la commande."),
  channel: z.enum(ORDER_CHANNELS, { message: "Choisissez le canal de la commande." }),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().positive("Quantité invalide.").max(10_000_000) }))
    .min(1, "Ajoutez au moins un produit.")
    .max(200),
  deliveryFee: z.coerce.number().int().min(0, "Frais de livraison invalides.").default(0),
  deliveryAddress: z.string().trim().max(300).optional().default(""),
  amountPaid: z.coerce.number().int().min(0).default(0),
  paymentMethod: z.enum(PAYING_METHODS).nullable().optional(),
  note: z.string().trim().max(500).optional().default(""),
});

export async function createOrder(input: z.input<typeof orderSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("orders.manage");
    if (!ctx.business.moduleOrders) throw new ActionError("Les commandes en ligne ne sont pas activées pour ce commerce.");
    const data = parse(orderSchema, input);

    const id = await db.transaction(async (tx) => {
      const customerId = await assertCustomer(tx, ctx.business.id, data.customerId);
      const lines = await priceAndReserve(tx, ctx, data.items);
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      const total = subtotal + data.deliveryFee;
      if (data.amountPaid > total) throw new ActionError("Le montant payé dépasse le total de la commande.");
      if (data.amountPaid > 0 && !data.paymentMethod) throw new ActionError("Indiquez le mode de paiement de l'acompte.");

      const [order] = await tx
        .insert(sales)
        .values({
          businessId: ctx.business.id,
          locationId: ctx.location.id,
          number: await nextNumber(tx, ctx.business.id, "order"),
          kind: "order",
          channel: data.channel,
          status: "new",
          customerId,
          userId: ctx.user.id,
          subtotal,
          deliveryFee: data.deliveryFee,
          total,
          amountPaid: data.amountPaid,
          paymentMethod: data.amountPaid > 0 ? (data.paymentMethod ?? null) : null,
          deliveryAddress: data.deliveryAddress || null,
          note: data.note || null,
        })
        .returning({ id: sales.id });
      await tx.insert(saleItems).values(lines.map((l) => ({ saleId: order!.id, ...l })));
      return order!.id;
    });

    revalidatePath("/", "layout");
    return { id };
  });
}

export async function updateOrderStatus(id: string, to: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("orders.manage");
    if (!isOrderStatus(to)) throw new ActionError("Statut inconnu.");

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, id), eq(sales.businessId, ctx.business.id), eq(sales.kind, "order")))
        .for("update");
      if (!order) throw new ActionError("Commande introuvable.");
      const from = order.status;
      if (!isOrderStatus(from) || !canTransition(from, to)) {
        throw new ActionError(
          `Impossible de passer de « ${isOrderStatus(from) ? ORDER_STATUS_LABELS[from] : from} » à « ${ORDER_STATUS_LABELS[to]} ».`,
        );
      }

      const effect = orderStockEffect(from, to);
      if (effect !== "none") {
        const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, id));
        const withProduct = items.filter((i) => i.productId);
        if (effect === "out") {
          const physical = await lockStock(
            tx,
            ctx.business.id,
            order.locationId,
            withProduct.map((i) => i.productId!),
          );
          for (const i of withProduct) {
            const have = physical.get(i.productId!) ?? 0;
            if (i.quantity > have) {
              throw new ActionError(`Stock insuffisant pour « ${i.name} » : il reste ${formatQty(have, i.unit)}.`);
            }
          }
        }
        for (const i of withProduct) {
          await applyStockMovement(tx, {
            businessId: ctx.business.id,
            locationId: order.locationId,
            productId: i.productId!,
            quantity: effect === "out" ? -i.quantity : i.quantity,
            type: effect === "out" ? "order_out" : "order_return",
            refType: "order",
            refId: id,
            unitCost: i.unitCost,
            userId: ctx.user.id,
          });
        }
      }

      const now = new Date();
      await tx
        .update(sales)
        .set({
          status: to,
          ...(to === "delivered" ? { completedAt: now } : {}),
          ...(to === "cancelled" || to === "returned" ? { cancelledAt: now } : {}),
        })
        .where(eq(sales.id, id));
      if (to === "cancelled" || to === "returned") await cancelInvoicesOfSale(tx, id);
    });

    revalidatePath("/", "layout");
    return null;
  });
}

const orderPaymentSchema = z.object({
  amount: z.coerce.number().int("Montant en FCFA entiers.").positive("Le montant doit être supérieur à 0."),
  method: z.enum(PAYING_METHODS, { message: "Choisissez un mode de paiement." }),
});

export async function recordOrderPayment(id: string, input: z.input<typeof orderPaymentSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("orders.manage");
    const data = parse(orderPaymentSchema, input);

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, id), eq(sales.businessId, ctx.business.id), eq(sales.kind, "order")))
        .for("update");
      if (!order) throw new ActionError("Commande introuvable.");
      if (order.status === "cancelled" || order.status === "returned") {
        throw new ActionError("Cette commande est annulée ou retournée.");
      }
      const rest = order.total - order.amountPaid;
      if (rest <= 0) throw new ActionError("Cette commande est déjà payée.");
      if (data.amount > rest) throw new ActionError(`Le montant dépasse le reste à payer (${formatFCFA(rest)}).`);
      await tx
        .update(sales)
        .set({ amountPaid: order.amountPaid + data.amount, paymentMethod: order.paymentMethod ?? data.method })
        .where(eq(sales.id, id));
    });

    revalidatePath("/", "layout");
    return null;
  });
}

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

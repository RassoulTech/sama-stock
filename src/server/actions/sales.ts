"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { saleItems, sales } from "@/db/schema";
import { SALE_METHODS } from "@/lib/domain/sales";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";
import { nextNumber } from "../services/numbering";
import { findSaleByClientRef } from "../services/offline-sales";
import { assertCustomer, priceAndReserve } from "../services/sale-lines";
import { applyStockMovement } from "../services/stock";

const saleSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().positive("Quantité invalide.").max(10_000_000) }))
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
      const lines = await priceAndReserve(tx, ctx, data.items);
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      if (data.discount > subtotal) throw new ActionError("La remise dépasse le montant du panier.");
      const total = subtotal - data.discount;
      const amountPaid = data.paymentMethod === "credit" ? 0 : Math.min(data.amountReceived, total);

      const customerId = await assertCustomer(tx, ctx.business.id, data.customerId);
      if (amountPaid < total && !customerId) {
        throw new ActionError("Choisissez le client : une vente à crédit ou un paiement partiel doit être rattaché à un client.");
      }

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
          discount: data.discount,
          total,
          amountPaid,
          paymentMethod: data.paymentMethod,
          note: data.note || null,
          createdAt: now,
          completedAt: now,
          clientRef: data.clientRef ?? null,
        })
        .returning({ id: sales.id });

      await tx.insert(saleItems).values(lines.map((l) => ({ saleId: sale!.id, ...l })));
      for (const l of lines) {
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
      return sale!.id;
    });

    revalidatePath("/", "layout");
    return { id };
  });
}

export async function cancelSale(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.cancel");

    await db.transaction(async (tx) => {
      const [sale] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, id), eq(sales.businessId, ctx.business.id), eq(sales.kind, "sale")))
        .for("update");
      if (!sale) throw new ActionError("Vente introuvable.");
      if (sale.status !== "completed") throw new ActionError("Cette vente est déjà annulée.");

      await tx.update(sales).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(sales.id, id));
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
    });

    revalidatePath("/", "layout");
    return null;
  });
}

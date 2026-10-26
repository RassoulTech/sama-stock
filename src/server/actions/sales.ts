"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { saleItems, sales } from "@/db/schema";
import { SALE_METHODS } from "@/lib/domain/sales";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";
import { cancelInvoicesOfSale } from "../services/documents";
import { findSaleByClientRef } from "../services/offline-sales";
import { priceAndReserve } from "../services/sale-lines";
import { recordShopSale } from "../services/shop-sale";
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
      return recordShopSale(tx, ctx, {
        lines,
        discount: data.discount,
        customerId: data.customerId,
        paymentMethod: data.paymentMethod,
        amountReceived: data.amountReceived,
        note: data.note,
        clientRef: data.clientRef,
      });
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
    });

    revalidatePath("/", "layout");
    return null;
  });
}

import "server-only";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { locations, products, purchaseItems, purchases, stockMovements, suppliers, user } from "@/db/schema";
import type { BusinessContext } from "../context";

export const MOVEMENT_GROUPS = {
  all: { label: "Tous", types: null },
  in: { label: "Entrées", types: ["initial", "purchase", "order_return", "sale_cancel"] },
  out: { label: "Ventes et sorties", types: ["sale", "order_out", "out"] },
  loss: { label: "Pertes et inventaire", types: ["adjust", "inventory"] },
  transfer: { label: "Transferts", types: ["transfer_in", "transfer_out"] },
} as const;

export type MovementGroup = keyof typeof MOVEMENT_GROUPS;

export async function listMovements(
  ctx: BusinessContext,
  opts: { group?: MovementGroup; limit?: number } = {},
) {
  const group = MOVEMENT_GROUPS[opts.group ?? "all"];
  const conditions: SQL[] = [eq(stockMovements.businessId, ctx.business.id)];
  if (group.types) conditions.push(inArray(stockMovements.type, [...group.types]));
  if (ctx.locations.length > 1) conditions.push(eq(stockMovements.locationId, ctx.location.id));

  return db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      reason: stockMovements.reason,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      locationName: locations.name,
      userName: user.name,
    })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .innerJoin(locations, eq(stockMovements.locationId, locations.id))
    .leftJoin(user, eq(stockMovements.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(stockMovements.createdAt))
    .limit(opts.limit ?? 150);
}

export async function listSuppliers(businessId: string) {
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      phone: suppliers.phone,
      note: suppliers.note,
      purchaseCount: sql<number>`count(${purchases.id})::int`,
      totalPurchased: sql<number>`coalesce(sum(${purchases.total}), 0)::int`,
      lastPurchaseAt: sql<Date | null>`max(${purchases.createdAt})`,
    })
    .from(suppliers)
    .leftJoin(purchases, eq(purchases.supplierId, suppliers.id))
    .where(eq(suppliers.businessId, businessId))
    .groupBy(suppliers.id)
    .orderBy(asc(suppliers.name));
}

export async function getSupplier(ctx: BusinessContext, id: string) {
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.businessId, ctx.business.id)));
  if (!supplier) return null;

  const rows = await db
    .select({
      id: purchases.id,
      total: purchases.total,
      note: purchases.note,
      createdAt: purchases.createdAt,
      locationName: locations.name,
      userName: user.name,
      itemCount: sql<number>`(select count(*)::int from ${purchaseItems} where ${purchaseItems.purchaseId} = ${purchases.id})`,
      summary: sql<string>`(select string_agg(p.name, ', ' order by p.name) from ${purchaseItems} pi join ${products} p on p.id = pi.product_id where pi.purchase_id = ${purchases.id})`,
    })
    .from(purchases)
    .innerJoin(locations, eq(purchases.locationId, locations.id))
    .leftJoin(user, eq(purchases.userId, user.id))
    .where(and(eq(purchases.supplierId, id), eq(purchases.businessId, ctx.business.id)))
    .orderBy(desc(purchases.createdAt))
    .limit(100);

  return { supplier, purchases: rows };
}

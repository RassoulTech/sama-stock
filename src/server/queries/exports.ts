import "server-only";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { categories, customers, locations, products, saleItems, sales, user } from "@/db/schema";
import type { BusinessContext } from "../context";
import { COMPLETED_SALE } from "./customers";

const seller = alias(user, "seller");

/** Nombre maximum de lignes de vente exportées. */
export const EXPORT_LINE_LIMIT = 20_000;

/** Détail ligne par ligne des ventes validées et commandes livrées de la période. */
export async function saleLines(ctx: BusinessContext, from: Date, to: Date) {
  return db
    .select({
      completedAt: sales.completedAt,
      number: sales.number,
      kind: sales.kind,
      channel: sales.channel,
      paymentMethod: sales.paymentMethod,
      locationName: locations.name,
      customerName: customers.name,
      sellerName: seller.name,
      product: saleItems.name,
      category: categories.name,
      quantity: saleItems.quantity,
      unit: saleItems.unit,
      unitPrice: saleItems.unitPrice,
      lineTotal: saleItems.lineTotal,
      unitCost: saleItems.unitCost,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(locations, eq(sales.locationId, locations.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(seller, eq(sales.userId, seller.id))
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(sales.businessId, ctx.business.id), COMPLETED_SALE, gte(sales.completedAt, from), lt(sales.completedAt, to)))
    .orderBy(asc(sales.completedAt), asc(sales.number))
    .limit(EXPORT_LINE_LIMIT);
}

/** Tous les produits vendus sur la période, du plus gros chiffre d'affaires au plus petit. */
export async function productSales(ctx: BusinessContext, from: Date, to: Date) {
  const rows = await db
    .select({
      name: sql<string>`max(${saleItems.name})`,
      category: sql<string | null>`max(${categories.name})`,
      unit: sql<string>`max(${saleItems.unit})`,
      quantity: sql<number>`sum(${saleItems.quantity})::float8`,
      revenue: sql<number>`sum(${saleItems.lineTotal})::int`,
      profit: sql<number>`sum(${saleItems.lineTotal} - round(${saleItems.unitCost} * ${saleItems.quantity}))::int`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(sales.businessId, ctx.business.id), COMPLETED_SALE, gte(sales.completedAt, from), lt(sales.completedAt, to)))
    .groupBy(sql`coalesce(${saleItems.productId}, ${saleItems.name})`)
    .orderBy(desc(sql`sum(${saleItems.lineTotal})`));
  return rows.map((r) => ({ ...r, quantity: Number(r.quantity), revenue: Number(r.revenue), profit: Number(r.profit) }));
}

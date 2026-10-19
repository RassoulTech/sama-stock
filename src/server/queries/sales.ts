import "server-only";
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { customers, locations, saleItems, sales, user } from "@/db/schema";
import type { BusinessContext } from "../context";

export const PERIODS = {
  today: { label: "Aujourd'hui", days: 0 },
  "7j": { label: "7 jours", days: 7 },
  "30j": { label: "30 jours", days: 30 },
  "90j": { label: "90 jours", days: 90 },
} as const;

export type Period = keyof typeof PERIODS;

/** Début de période, en heure de Dakar (UTC+0). */
export function periodStart(period: Period, now = new Date()): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = PERIODS[period].days;
  if (days > 0) start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

const seller = alias(user, "seller");

export async function listSales(ctx: BusinessContext, opts: { period: Period }) {
  const conditions: SQL[] = [
    eq(sales.businessId, ctx.business.id),
    eq(sales.kind, "sale"),
    gte(sales.createdAt, periodStart(opts.period)),
  ];
  // Un vendeur ne voit que ses propres ventes
  if (!ctx.can("dashboard.full")) conditions.push(eq(sales.userId, ctx.user.id));
  if (ctx.locations.length > 1) conditions.push(eq(sales.locationId, ctx.location.id));

  return db
    .select({
      id: sales.id,
      number: sales.number,
      status: sales.status,
      total: sales.total,
      amountPaid: sales.amountPaid,
      paymentMethod: sales.paymentMethod,
      createdAt: sales.createdAt,
      customerName: customers.name,
      sellerName: seller.name,
      itemCount: sql<number>`(select count(*)::int from ${saleItems} where ${saleItems.saleId} = ${sales.id})`,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(seller, eq(sales.userId, seller.id))
    .where(and(...conditions))
    .orderBy(desc(sales.createdAt))
    .limit(300);
}

/** Vente ou commande complète (pour le reçu et la fiche commande). */
export async function getSale(ctx: BusinessContext, id: string) {
  const [row] = await db
    .select({
      sale: sales,
      customer: { id: customers.id, name: customers.name, phone: customers.phone, address: customers.address },
      sellerName: seller.name,
      locationName: locations.name,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(seller, eq(sales.userId, seller.id))
    .innerJoin(locations, eq(sales.locationId, locations.id))
    .where(and(eq(sales.id, id), eq(sales.businessId, ctx.business.id)));
  if (!row) return null;
  if (!ctx.can("dashboard.full") && row.sale.kind === "sale" && row.sale.userId !== ctx.user.id) return null;

  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id));
  const showCost = ctx.can("costs.view");
  const profit = showCost
    ? items.reduce((s, i) => s + i.lineTotal - Math.round(i.unitCost * i.quantity), 0) - row.sale.discount
    : null;

  return {
    ...row.sale,
    customer: row.customer?.id ? row.customer : null,
    sellerName: row.sellerName,
    locationName: row.locationName,
    items: items.map((i) => ({ ...i, unitCost: showCost ? i.unitCost : null })),
    profit,
  };
}

export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSale>>>;

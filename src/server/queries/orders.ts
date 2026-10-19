import "server-only";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers, saleItems, sales } from "@/db/schema";
import { OPEN_STATUSES } from "@/lib/domain/orders";
import type { BusinessContext } from "../context";

export const ORDER_FILTERS = {
  open: { label: "En cours", statuses: [...OPEN_STATUSES] },
  new: { label: "Nouvelles", statuses: ["new"] },
  preparing: { label: "En préparation", statuses: ["preparing"] },
  shipping: { label: "En livraison", statuses: ["shipping"] },
  delivered: { label: "Livrées", statuses: ["delivered"] },
  closed: { label: "Annulées / retournées", statuses: ["cancelled", "returned"] },
  all: { label: "Toutes", statuses: null },
} as const;

export type OrderFilter = keyof typeof ORDER_FILTERS;

function baseConditions(ctx: BusinessContext): SQL[] {
  const c: SQL[] = [eq(sales.businessId, ctx.business.id), eq(sales.kind, "order")];
  if (ctx.locations.length > 1) c.push(eq(sales.locationId, ctx.location.id));
  return c;
}

export async function listOrders(ctx: BusinessContext, filter: OrderFilter) {
  const conditions = baseConditions(ctx);
  const statuses = ORDER_FILTERS[filter].statuses;
  if (statuses) conditions.push(inArray(sales.status, [...statuses]));

  return db
    .select({
      id: sales.id,
      number: sales.number,
      status: sales.status,
      channel: sales.channel,
      total: sales.total,
      amountPaid: sales.amountPaid,
      createdAt: sales.createdAt,
      customerName: customers.name,
      customerPhone: customers.phone,
      itemCount: sql<number>`(select count(*)::int from ${saleItems} where ${saleItems.saleId} = ${sales.id})`,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(sales.createdAt))
    .limit(300);
}

export async function orderCounts(ctx: BusinessContext): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: sales.status, n: sql<number>`count(*)::int` })
    .from(sales)
    .where(and(...baseConditions(ctx)))
    .groupBy(sales.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

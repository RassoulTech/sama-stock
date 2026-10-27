import "server-only";
import { and, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers, saleItems, sales } from "@/db/schema";
import { OPEN_STATUSES } from "@/lib/domain/orders";
import type { Channel } from "@/lib/domain/sales";
import type { BusinessContext } from "../context";
import { likePattern } from "./sales";

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

/** Filtres communs à la liste et aux compteurs (tout sauf le statut). */
export interface OrderSearch {
  from?: Date | null;
  to?: Date | null;
  channel?: Channel | null;
  q?: string;
}

function baseConditions(ctx: BusinessContext, f: OrderSearch = {}): SQL[] {
  const c: SQL[] = [eq(sales.businessId, ctx.business.id), eq(sales.kind, "order")];
  if (ctx.locations.length > 1) c.push(eq(sales.locationId, ctx.location.id));
  if (f.from) c.push(gte(sales.createdAt, f.from));
  if (f.to) c.push(lt(sales.createdAt, f.to));
  if (f.channel) c.push(eq(sales.channel, f.channel));
  if (f.q) c.push(or(ilike(sales.number, likePattern(f.q)), ilike(customers.name, likePattern(f.q)), ilike(customers.phone, likePattern(f.q)))!);
  return c;
}

export async function listOrders(
  ctx: BusinessContext,
  filter: OrderFilter,
  search: OrderSearch = {},
  page: { limit: number; offset: number } = { limit: 300, offset: 0 },
) {
  const conditions = baseConditions(ctx, search);
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
    .orderBy(desc(sales.createdAt), desc(sales.id))
    .limit(page.limit)
    .offset(page.offset);
}

export async function orderCounts(ctx: BusinessContext, search: OrderSearch = {}): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: sales.status, n: sql<number>`count(*)::int` })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(and(...baseConditions(ctx, search)))
    .groupBy(sales.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

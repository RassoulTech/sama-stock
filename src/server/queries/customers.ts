import "server-only";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerPayments, customers, sales, user } from "@/db/schema";
import type { BusinessContext } from "../context";

/** Ventes validées et commandes livrées : ce qui compte dans le chiffre d'affaires et les dettes. */
export const COMPLETED_SALE = or(
  and(eq(sales.kind, "sale"), eq(sales.status, "completed")),
  and(eq(sales.kind, "order"), eq(sales.status, "delivered")),
)!;

export async function listCustomers(businessId: string) {
  const stats = db
    .select({
      customerId: sales.customerId,
      debt: sql<number>`coalesce(sum(${sales.total} - ${sales.amountPaid}), 0)::int`.as("debt"),
      spent: sql<number>`coalesce(sum(${sales.total}), 0)::int`.as("spent"),
      count: sql<number>`count(*)::int`.as("count"),
      last: sql<Date | null>`max(${sales.completedAt})`.as("last"),
    })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), COMPLETED_SALE))
    .groupBy(sales.customerId)
    .as("stats");

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      address: customers.address,
      debt: sql<number>`coalesce(${stats.debt}, 0)`,
      spent: sql<number>`coalesce(${stats.spent}, 0)`,
      purchaseCount: sql<number>`coalesce(${stats.count}, 0)`,
      lastPurchaseAt: stats.last,
    })
    .from(customers)
    .leftJoin(stats, eq(stats.customerId, customers.id))
    .where(eq(customers.businessId, businessId))
    .orderBy(asc(customers.name));

  return rows.map((r) => ({ ...r, debt: Number(r.debt), spent: Number(r.spent), purchaseCount: Number(r.purchaseCount) }));
}

export type CustomerRow = Awaited<ReturnType<typeof listCustomers>>[number];

export async function getCustomer(ctx: BusinessContext, id: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id)));
  if (!customer) return null;

  const history = await db
    .select({
      id: sales.id,
      number: sales.number,
      kind: sales.kind,
      status: sales.status,
      channel: sales.channel,
      total: sales.total,
      amountPaid: sales.amountPaid,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .where(and(eq(sales.businessId, ctx.business.id), eq(sales.customerId, id)))
    .orderBy(desc(sales.createdAt))
    .limit(100);

  const payments = await db
    .select({
      id: customerPayments.id,
      amount: customerPayments.amount,
      method: customerPayments.method,
      note: customerPayments.note,
      createdAt: customerPayments.createdAt,
      userName: user.name,
    })
    .from(customerPayments)
    .leftJoin(user, eq(customerPayments.userId, user.id))
    .where(and(eq(customerPayments.businessId, ctx.business.id), eq(customerPayments.customerId, id)))
    .orderBy(desc(customerPayments.createdAt))
    .limit(100);

  const [debtRow] = await db
    .select({ debt: sql<number>`coalesce(sum(${sales.total} - ${sales.amountPaid}), 0)::int` })
    .from(sales)
    .where(and(eq(sales.businessId, ctx.business.id), eq(sales.customerId, id), COMPLETED_SALE));

  return { customer, history, payments, debt: Number(debtRow?.debt ?? 0) };
}

export async function totalCustomerDebt(businessId: string) {
  const [row] = await db
    .select({
      debt: sql<number>`coalesce(sum(${sales.total} - ${sales.amountPaid}), 0)::int`,
      debtors: sql<number>`count(distinct ${sales.customerId})::int`,
    })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), COMPLETED_SALE, sql`${sales.total} > ${sales.amountPaid}`));
  return { debt: Number(row?.debt ?? 0), debtors: Number(row?.debtors ?? 0) };
}

export async function customerOptions(businessId: string) {
  return db
    .select({ id: customers.id, name: customers.name, phone: customers.phone })
    .from(customers)
    .where(eq(customers.businessId, businessId))
    .orderBy(asc(customers.name));
}

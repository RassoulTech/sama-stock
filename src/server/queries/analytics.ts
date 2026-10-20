import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, saleItems, sales, stockMovements } from "@/db/schema";
import type { BusinessContext } from "../context";
import { COMPLETED_SALE } from "./customers";

function scope(ctx: BusinessContext, opts: { own?: boolean } = {}): SQL[] {
  const c: SQL[] = [eq(sales.businessId, ctx.business.id), COMPLETED_SALE];
  if (opts.own) c.push(eq(sales.userId, ctx.user.id));
  return c;
}

/** Chiffre d'affaires produits (hors frais de livraison), nombre de ventes et bénéfice brut. */
export async function salesSummary(ctx: BusinessContext, from: Date, opts: { own?: boolean; to?: Date } = {}) {
  const conditions = [...scope(ctx, opts), gte(sales.completedAt, from)];
  if (opts.to) conditions.push(lt(sales.completedAt, opts.to));

  const [totals] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${sales.subtotal} - ${sales.discount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(and(...conditions));

  const [cost] = await db
    .select({ cost: sql<number>`coalesce(sum(round(${saleItems.unitCost} * ${saleItems.quantity})), 0)::int` })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(...conditions));

  const revenue = Number(totals?.revenue ?? 0);
  return { revenue, count: Number(totals?.count ?? 0), profit: revenue - Number(cost?.cost ?? 0) };
}

/** Série journalière (jours sans vente inclus) du chiffre d'affaires et du bénéfice. */
export async function dailySeries(ctx: BusinessContext, from: Date, days: number) {
  const rows = await db.execute<{ day: string; revenue: number; profit: number }>(sql`
    with d as (
      select generate_series(${from.toISOString()}::date, (${from.toISOString()}::date + ${days - 1}::int), interval '1 day')::date as day
    ),
    s as (
      select ${sales.completedAt}::date as day,
             sum(${sales.subtotal} - ${sales.discount}) as revenue,
             sum(${sales.subtotal} - ${sales.discount}) - coalesce(sum(c.cost), 0) as profit
      from ${sales}
      left join lateral (
        select sum(round(${saleItems.unitCost} * ${saleItems.quantity})) as cost
        from ${saleItems} where ${saleItems.saleId} = ${sales.id}
      ) c on true
      where ${and(...scope(ctx), gte(sales.completedAt, from))}
      group by 1
    )
    select to_char(d.day, 'YYYY-MM-DD') as day,
           coalesce(s.revenue, 0)::int as revenue,
           coalesce(s.profit, 0)::int as profit
    from d left join s on s.day = d.day
    order by d.day
  `);
  return rows.rows.map((r) => ({ day: r.day, revenue: Number(r.revenue), profit: Number(r.profit) }));
}

/** Conditions de période sur la date de validation (fin exclue). */
function between(from: Date, to?: Date | null): SQL[] {
  const c: SQL[] = [gte(sales.completedAt, from)];
  if (to) c.push(lt(sales.completedAt, to));
  return c;
}

export async function topProducts(ctx: BusinessContext, from: Date, limit = 8, to?: Date | null) {
  const rows = await db
    .select({
      productId: saleItems.productId,
      name: sql<string>`max(${saleItems.name})`,
      unit: sql<string>`max(${saleItems.unit})`,
      quantity: sql<number>`sum(${saleItems.quantity})::float8`,
      revenue: sql<number>`sum(${saleItems.lineTotal})::int`,
      profit: sql<number>`sum(${saleItems.lineTotal} - round(${saleItems.unitCost} * ${saleItems.quantity}))::int`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(...scope(ctx), ...between(from, to)))
    .groupBy(saleItems.productId)
    .orderBy(desc(sql`sum(${saleItems.lineTotal})`))
    .limit(50);
  const mapped = rows.map((r) => ({ ...r, quantity: Number(r.quantity), revenue: Number(r.revenue), profit: Number(r.profit) }));
  return {
    byRevenue: mapped.slice(0, limit),
    byProfit: [...mapped].sort((a, b) => b.profit - a.profit).slice(0, limit),
  };
}

export async function breakdown(ctx: BusinessContext, from: Date, by: "channel" | "paymentMethod", to?: Date | null) {
  const column = by === "channel" ? sales.channel : sales.paymentMethod;
  const rows = await db
    .select({
      key: sql<string | null>`${column}`,
      revenue: sql<number>`sum(${sales.subtotal} - ${sales.discount})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(and(...scope(ctx), ...between(from, to)))
    .groupBy(column)
    .orderBy(desc(sql`sum(${sales.subtotal} - ${sales.discount})`));
  return rows.map((r) => ({ key: r.key ?? "inconnu", revenue: Number(r.revenue), count: Number(r.count) }));
}

/**
 * Ventes par catégorie de produit : chiffre d'affaires des lignes (hors remises et livraison),
 * bénéfice brut, quantités et nombre de ventes. Les produits sans catégorie sont regroupés (id null).
 */
export async function categoryBreakdown(ctx: BusinessContext, from: Date, to?: Date | null) {
  const rows = await db
    .select({
      categoryId: products.categoryId,
      name: sql<string | null>`max(${categories.name})`,
      revenue: sql<number>`sum(${saleItems.lineTotal})::int`,
      profit: sql<number>`sum(${saleItems.lineTotal} - round(${saleItems.unitCost} * ${saleItems.quantity}))::int`,
      quantity: sql<number>`sum(${saleItems.quantity})::float8`,
      saleCount: sql<number>`count(distinct ${sales.id})::int`,
      productCount: sql<number>`count(distinct ${saleItems.productId})::int`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...scope(ctx), ...between(from, to)))
    .groupBy(products.categoryId)
    .orderBy(desc(sql`sum(${saleItems.lineTotal})`));
  const total = rows.reduce((s, r) => s + Number(r.revenue), 0);
  return rows.map((r) => {
    const revenue = Number(r.revenue);
    return {
      categoryId: r.categoryId,
      name: r.name ?? "Sans catégorie",
      revenue,
      profit: Number(r.profit),
      quantity: Number(r.quantity),
      saleCount: Number(r.saleCount),
      productCount: Number(r.productCount),
      share: total > 0 ? Math.round((revenue / total) * 1000) / 10 : 0,
    };
  });
}

/** Produits en stock qui ne se sont pas vendus depuis `days` jours. */
export async function dormantProducts(ctx: BusinessContext, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db.execute<{ id: string; name: string; unit: string; quantity: number; value: number; last_sale: string | null }>(sql`
    select p.id, p.name, p.unit,
           coalesce(sum(sl.quantity), 0)::float8 as quantity,
           (coalesce(sum(sl.quantity), 0) * p.cost_price)::int as value,
           (select max(s.completed_at) from ${saleItems} si join ${sales} s on s.id = si.sale_id
             where si.product_id = p.id and s.business_id = ${ctx.business.id}
               and ((s.kind = 'sale' and s.status = 'completed') or (s.kind = 'order' and s.status = 'delivered'))) as last_sale
    from ${products} p
    left join stock_levels sl on sl.product_id = p.id
    where p.business_id = ${ctx.business.id} and p.archived_at is null and p.created_at < ${since.toISOString()}
    group by p.id
    having coalesce(sum(sl.quantity), 0) > 0
  `);
  return rows.rows
    .filter((r) => !r.last_sale || new Date(r.last_sale) < since)
    .map((r) => ({ ...r, quantity: Number(r.quantity), value: Number(r.value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

/** Pertes (casse, vol, perte, péremption, inventaire négatif) valorisées au coût. */
export async function losses(ctx: BusinessContext, from: Date, to?: Date | null) {
  const rows = await db
    .select({
      reason: stockMovements.reason,
      quantity: sql<number>`sum(-${stockMovements.quantity})::float8`,
      value: sql<number>`coalesce(sum(round(-${stockMovements.quantity} * coalesce(${stockMovements.unitCost}, 0))), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.businessId, ctx.business.id),
        inArray(stockMovements.type, ["adjust", "inventory"]),
        sql`${stockMovements.quantity} < 0`,
        gte(stockMovements.createdAt, from),
        ...(to ? [lt(stockMovements.createdAt, to)] : []),
      ),
    )
    .groupBy(stockMovements.reason)
    .orderBy(desc(sql`sum(round(-${stockMovements.quantity} * coalesce(${stockMovements.unitCost}, 0)))`));
  return rows.map((r) => ({ reason: r.reason ?? "loss", quantity: Number(r.quantity), value: Number(r.value), count: Number(r.count) }));
}

export async function stockValue(ctx: BusinessContext) {
  const [row] = await db.execute<{ value: number }>(sql`
    select coalesce(sum(greatest(sl.quantity, 0) * p.cost_price), 0)::bigint as value
    from stock_levels sl join ${products} p on p.id = sl.product_id
    where sl.business_id = ${ctx.business.id} and p.archived_at is null
  `).then((r) => r.rows);
  return Number(row?.value ?? 0);
}

export async function recentSales(ctx: BusinessContext, opts: { own?: boolean; limit?: number } = {}) {
  const conditions: SQL[] = [eq(sales.businessId, ctx.business.id), eq(sales.kind, "sale"), eq(sales.status, "completed")];
  if (opts.own) conditions.push(eq(sales.userId, ctx.user.id));
  return db
    .select({ id: sales.id, number: sales.number, total: sales.total, amountPaid: sales.amountPaid, createdAt: sales.createdAt })
    .from(sales)
    .where(and(...conditions))
    .orderBy(desc(sales.createdAt))
    .limit(opts.limit ?? 5);
}

export async function activeProductCount(businessId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.businessId, businessId), isNull(products.archivedAt)));
  return Number(row?.n ?? 0);
}

export async function anySale(businessId: string) {
  const [row] = await db.select({ id: sales.id }).from(sales).where(eq(sales.businessId, businessId)).orderBy(asc(sales.createdAt)).limit(1);
  return Boolean(row);
}

import "server-only";
import { and, asc, desc, eq, exists, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { customers, locations, members, products, saleItems, sales, user } from "@/db/schema";
import type { SaleMethod } from "@/lib/domain/sales";
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

/** États de paiement proposés dans le filtre des ventes. */
export const SALE_STATES = {
  payees: "Payées",
  credit: "Reste à payer",
  annulees: "Annulées",
  averifier: "À vérifier",
} as const;

export type SaleState = keyof typeof SALE_STATES;

export interface SaleFilters {
  from: Date | null;
  /** Fin exclue. */
  to: Date | null;
  method?: SaleMethod | null;
  state?: SaleState | null;
  categoryId?: string | null;
  sellerId?: string | null;
  q?: string;
}

/** Motif « contient » pour ILIKE (les caractères % et _ tapés sont pris à la lettre). */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function saleConditions(ctx: BusinessContext, f: SaleFilters): SQL[] {
  const conditions: SQL[] = [eq(sales.businessId, ctx.business.id), eq(sales.kind, "sale")];
  if (f.from) conditions.push(gte(sales.createdAt, f.from));
  if (f.to) conditions.push(lt(sales.createdAt, f.to));
  // Un vendeur ne voit que ses propres ventes
  if (!ctx.can("dashboard.full")) conditions.push(eq(sales.userId, ctx.user.id));
  else if (f.sellerId) conditions.push(eq(sales.userId, f.sellerId));
  if (ctx.locations.length > 1) conditions.push(eq(sales.locationId, ctx.location.id));
  if (f.method) conditions.push(eq(sales.paymentMethod, f.method));
  if (f.state === "payees") conditions.push(eq(sales.status, "completed"), sql`${sales.amountPaid} >= ${sales.total}`);
  if (f.state === "credit") conditions.push(eq(sales.status, "completed"), sql`${sales.amountPaid} < ${sales.total}`);
  if (f.state === "annulees") conditions.push(eq(sales.status, "cancelled"));
  if (f.state === "averifier") conditions.push(sql`cardinality(${sales.syncFlags}) > 0`);
  if (f.categoryId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(saleItems)
          .innerJoin(products, eq(saleItems.productId, products.id))
          .where(and(eq(saleItems.saleId, sales.id), eq(products.categoryId, f.categoryId))),
      ),
    );
  }
  if (f.q) conditions.push(or(ilike(sales.number, likePattern(f.q)), ilike(customers.name, likePattern(f.q)))!);
  return conditions;
}

/** Une page de ventes (les plus récentes d'abord). */
export async function listSales(ctx: BusinessContext, f: SaleFilters, page: { limit: number; offset: number }) {
  const conditions = saleConditions(ctx, f);
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
      offline: sql<boolean>`${sales.offlineSyncedAt} is not null`,
      flagged: sql<boolean>`cardinality(${sales.syncFlags}) > 0`,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(seller, eq(sales.userId, seller.id))
    .where(and(...conditions))
    .orderBy(desc(sales.createdAt), desc(sales.id))
    .limit(page.limit)
    .offset(page.offset);
}

/** Totaux de toutes les ventes filtrées (pas seulement la page affichée). */
export async function salesSummary(ctx: BusinessContext, f: SaleFilters) {
  const completed = sql`${sales.status} = 'completed'`;
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      valid: sql<number>`(count(*) filter (where ${completed}))::int`,
      revenue: sql<number>`coalesce(sum(${sales.total}) filter (where ${completed}), 0)::bigint`,
      cashed: sql<number>`coalesce(sum(${sales.amountPaid}) filter (where ${completed}), 0)::bigint`,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(and(...saleConditions(ctx, f)));
  return { count: row?.count ?? 0, valid: row?.valid ?? 0, revenue: Number(row?.revenue ?? 0), cashed: Number(row?.cashed ?? 0) };
}

/** Ventes faites sans internet qui demandent une vérification (stock négatif, prix différent…). */
export async function countFlaggedSales(ctx: BusinessContext, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sales)
    .where(
      and(
        eq(sales.businessId, ctx.business.id),
        eq(sales.kind, "sale"),
        gte(sales.createdAt, since),
        sql`cardinality(${sales.syncFlags}) > 0`,
      ),
    );
  return row?.n ?? 0;
}

/** Membres de l'équipe, pour filtrer les ventes par vendeur. */
export async function listSellers(ctx: BusinessContext) {
  return db
    .select({ id: user.id, name: user.name })
    .from(members)
    .innerJoin(user, eq(members.userId, user.id))
    .where(eq(members.businessId, ctx.business.id))
    .orderBy(asc(user.name));
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

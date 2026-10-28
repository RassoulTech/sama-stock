import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { locations, products, purchaseItems, purchases, stockMovements, suppliers, user } from "@/db/schema";
import type { BusinessContext } from "../context";
import { likePattern } from "./sales";

export const MOVEMENT_GROUPS = {
  all: { label: "Tous", types: null },
  in: { label: "Entrées", types: ["initial", "purchase", "order_return", "sale_cancel"] },
  out: { label: "Ventes et sorties", types: ["sale", "order_out", "out"] },
  loss: { label: "Pertes et inventaire", types: ["adjust", "inventory"] },
  transfer: { label: "Transferts", types: ["transfer_in", "transfer_out"] },
  fix: { label: "Corrections", types: ["correction", "purchase_cancel", "movement_cancel"] },
} as const;

export type MovementGroup = keyof typeof MOVEMENT_GROUPS;

/** Colonnes pour annuler depuis l'historique : la ligne (ou son entrée de stock) est-elle déjà annulée ? */
export const movementCancelColumns = {
  refType: stockMovements.refType,
  refId: stockMovements.refId,
  cancelled: sql<boolean>`(${stockMovements.cancelledAt} is not null or (${stockMovements.type} = 'purchase' and ${stockMovements.refType} = 'purchase' and exists (select 1 from ${purchases} where ${purchases.id} = ${stockMovements.refId} and ${purchases.cancelledAt} is not null)))`,
};

type MovementFilters = { group?: MovementGroup; from?: Date | null; to?: Date | null; q?: string; categoryId?: string | null };

function movementConditions(ctx: BusinessContext, opts: MovementFilters): SQL[] {
  const group = MOVEMENT_GROUPS[opts.group ?? "all"];
  const conditions: SQL[] = [eq(stockMovements.businessId, ctx.business.id), ne(stockMovements.quantity, 0)];
  if (group.types) conditions.push(inArray(stockMovements.type, [...group.types]));
  if (ctx.locations.length > 1) conditions.push(eq(stockMovements.locationId, ctx.location.id));
  if (opts.from) conditions.push(gte(stockMovements.createdAt, opts.from));
  if (opts.to) conditions.push(lt(stockMovements.createdAt, opts.to));
  if (opts.q) conditions.push(ilike(products.name, likePattern(opts.q)));
  if (opts.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
  return conditions;
}

/** Nombre de mouvements qui correspondent aux filtres (pour les pages). */
export async function countMovements(ctx: BusinessContext, opts: MovementFilters = {}) {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .where(and(...movementConditions(ctx, opts)));
  return row?.total ?? 0;
}

export async function listMovements(ctx: BusinessContext, opts: MovementFilters = {}, page: { limit: number; offset: number } = { limit: 150, offset: 0 }) {
  const conditions = movementConditions(ctx, opts);
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
      ...movementCancelColumns,
    })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .innerJoin(locations, eq(stockMovements.locationId, locations.id))
    .leftJoin(user, eq(stockMovements.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(page.limit)
    .offset(page.offset);
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
    .leftJoin(purchases, and(eq(purchases.supplierId, suppliers.id), isNull(purchases.cancelledAt)))
    .where(eq(suppliers.businessId, businessId))
    .groupBy(suppliers.id)
    .orderBy(asc(suppliers.name));
}

export async function getSupplier(ctx: BusinessContext, id: string, page: { limit: number; offset: number } = { limit: 100, offset: 0 }) {
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
      cancelledAt: purchases.cancelledAt,
      locationName: locations.name,
      userName: user.name,
      itemCount: sql<number>`(select count(*)::int from ${purchaseItems} where ${purchaseItems.purchaseId} = ${purchases.id})`,
      summary: sql<string>`(select string_agg(p.name, ', ' order by p.name) from ${purchaseItems} pi join ${products} p on p.id = pi.product_id where pi.purchase_id = ${purchases.id})`,
    })
    .from(purchases)
    .innerJoin(locations, eq(purchases.locationId, locations.id))
    .leftJoin(user, eq(purchases.userId, user.id))
    .where(and(eq(purchases.supplierId, id), eq(purchases.businessId, ctx.business.id)))
    .orderBy(desc(purchases.createdAt), desc(purchases.id))
    .limit(page.limit)
    .offset(page.offset);

  // Totaux de tous les achats (pas seulement la page affichée)
  const [summary] = await db
    .select({ count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${purchases.total}), 0)::bigint` })
    .from(purchases)
    .where(and(eq(purchases.supplierId, id), eq(purchases.businessId, ctx.business.id), isNull(purchases.cancelledAt)));

  return { supplier, purchases: rows, purchaseCount: summary?.count ?? 0, purchaseTotal: Number(summary?.total ?? 0) };
}

// ── Inventaires ─────────────────────────────────────────────────────────────

/** Lignes d'inventaire du commerce (et de la boutique en cours quand il y en a plusieurs). */
function inventoryWhere(ctx: BusinessContext, id?: string): SQL {
  return and(
    eq(stockMovements.businessId, ctx.business.id),
    eq(stockMovements.refType, "inventory"),
    id ? eq(stockMovements.refId, id) : isNotNull(stockMovements.refId),
    ...(ctx.locations.length > 1 ? [eq(stockMovements.locationId, ctx.location.id)] : []),
  )!;
}

const missingValue = sql<number>`coalesce(sum(round(-${stockMovements.quantity} * coalesce(${stockMovements.unitCost}, 0))) filter (where ${stockMovements.quantity} < 0), 0)::int`;
const surplusValue = sql<number>`coalesce(sum(round(${stockMovements.quantity} * coalesce(${stockMovements.unitCost}, 0))) filter (where ${stockMovements.quantity} > 0), 0)::int`;

/** Inventaires passés, du plus récent au plus ancien (un comptage = les lignes qui partagent son identifiant). */
export async function listInventories(ctx: BusinessContext, page: { limit: number; offset: number }) {
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: sql<string>`${stockMovements.refId}`,
        createdAt: sql<Date>`min(${stockMovements.createdAt})`,
        userName: sql<string | null>`max(${user.name})`,
        counted: sql<number>`count(*)::int`,
        gaps: sql<number>`(count(*) filter (where ${stockMovements.quantity} <> 0))::int`,
        missingValue,
        surplusValue,
      })
      .from(stockMovements)
      .leftJoin(user, eq(stockMovements.userId, user.id))
      .where(inventoryWhere(ctx))
      .groupBy(stockMovements.refId)
      .orderBy(desc(sql`min(${stockMovements.createdAt})`))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ total: sql<number>`count(distinct ${stockMovements.refId})::int` })
      .from(stockMovements)
      .where(inventoryWhere(ctx)),
  ]);
  return { rows: rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })), total: count?.total ?? 0 };
}

/** Détail d'un inventaire : les produits comptés, écarts d'abord. */
export async function getInventory(ctx: BusinessContext, id: string) {
  const lines = await db
    .select({
      id: stockMovements.id,
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      quantity: stockMovements.quantity,
      unitCost: stockMovements.unitCost,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      locationName: locations.name,
      userName: user.name,
    })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .innerJoin(locations, eq(stockMovements.locationId, locations.id))
    .leftJoin(user, eq(stockMovements.userId, user.id))
    .where(inventoryWhere(ctx, id))
    .orderBy(sql`${stockMovements.quantity} = 0`, asc(products.name));
  if (lines.length === 0) return null;
  const first = lines[0]!;
  const value = (q: number, cost: number | null) => Math.round(q * (cost ?? 0));
  return {
    id,
    createdAt: first.createdAt,
    userName: first.userName,
    locationName: first.locationName,
    note: first.note,
    lines,
    counted: lines.length,
    gaps: lines.filter((l) => l.quantity !== 0).length,
    missingValue: lines.filter((l) => l.quantity < 0).reduce((s, l) => s - value(l.quantity, l.unitCost), 0),
    surplusValue: lines.filter((l) => l.quantity > 0).reduce((s, l) => s + value(l.quantity, l.unitCost), 0),
  };
}

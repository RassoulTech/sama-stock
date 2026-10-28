import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { categories, documentItems, locations, products, purchaseItems, saleItems, stockLevels, stockMovements, user } from "@/db/schema";
import { roundQty, stockStatus, type StockStatus } from "@/lib/domain/stock";
import type { BusinessContext } from "../context";
import { reservedQuantities } from "../services/stock";
import { movementCancelColumns } from "./stock";

export interface ProductRow {
  id: string;
  name: string;
  reference: string | null;
  unit: string;
  categoryId: string | null;
  categoryName: string | null;
  salePrice: number;
  /** null quand l'utilisateur n'a pas le droit de voir les coûts */
  costPrice: number | null;
  alertThreshold: number;
  imageUrl: string | null;
  physical: number;
  reserved: number;
  available: number;
  status: StockStatus;
  archived: boolean;
}

export function productImageUrl(id: string, updatedAt: Date) {
  return `/api/images/produit/${id}?v=${updatedAt.getTime()}`;
}

export async function listProducts(
  ctx: BusinessContext,
  opts: { includeArchived?: boolean; locationId?: string } = {},
): Promise<ProductRow[]> {
  const locationId = opts.locationId ?? ctx.location.id;
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      reference: products.reference,
      unit: products.unit,
      categoryId: products.categoryId,
      categoryName: categories.name,
      salePrice: products.salePrice,
      costPrice: products.costPrice,
      alertThreshold: products.alertThreshold,
      hasImage: sql<boolean>`${products.imageData} is not null`,
      updatedAt: products.updatedAt,
      archivedAt: products.archivedAt,
      physical: sql<string>`coalesce(${stockLevels.quantity}, 0)`,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(stockLevels, and(eq(stockLevels.productId, products.id), eq(stockLevels.locationId, locationId)))
    .where(
      and(eq(products.businessId, ctx.business.id), opts.includeArchived ? undefined : isNull(products.archivedAt)),
    )
    .orderBy(asc(products.name));

  const reserved = await reservedQuantities(db, ctx.business.id, locationId);
  const showCost = ctx.can("costs.view");

  return rows.map((r) => {
    const physical = Number(r.physical);
    const res = reserved.get(r.id) ?? 0;
    const available = roundQty(physical - res);
    return {
      id: r.id,
      name: r.name,
      reference: r.reference,
      unit: r.unit,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      salePrice: r.salePrice,
      costPrice: showCost ? r.costPrice : null,
      alertThreshold: r.alertThreshold,
      imageUrl: r.hasImage ? productImageUrl(r.id, r.updatedAt) : null,
      physical,
      reserved: res,
      available,
      status: stockStatus(available, r.alertThreshold),
      archived: r.archivedAt !== null,
    };
  });
}

export async function countActiveProducts(businessId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.businessId, businessId), isNull(products.archivedAt)));
  return row?.n ?? 0;
}

export async function listCategories(businessId: string) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.businessId, businessId))
    .orderBy(asc(categories.name));
}

export async function getProduct(ctx: BusinessContext, id: string) {
  const [p] = await db
    .select({
      id: products.id,
      name: products.name,
      reference: products.reference,
      unit: products.unit,
      categoryId: products.categoryId,
      categoryName: categories.name,
      salePrice: products.salePrice,
      costPrice: products.costPrice,
      alertThreshold: products.alertThreshold,
      hasImage: sql<boolean>`${products.imageData} is not null`,
      updatedAt: products.updatedAt,
      archivedAt: products.archivedAt,
      createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.id, id), eq(products.businessId, ctx.business.id)));
  if (!p) return null;

  const levels = await db
    .select({ locationId: locations.id, locationName: locations.name, quantity: sql<string>`coalesce(${stockLevels.quantity}, 0)` })
    .from(locations)
    .leftJoin(stockLevels, and(eq(stockLevels.locationId, locations.id), eq(stockLevels.productId, id)))
    .where(eq(locations.businessId, ctx.business.id))
    .orderBy(asc(locations.createdAt));

  const perLocation = await Promise.all(
    levels.map(async (l) => {
      const reserved = (await reservedQuantities(db, ctx.business.id, l.locationId, [id])).get(id) ?? 0;
      const physical = Number(l.quantity);
      const available = roundQty(physical - reserved);
      return {
        locationId: l.locationId,
        locationName: l.locationName,
        physical,
        reserved,
        available,
        status: stockStatus(available, p.alertThreshold),
      };
    }),
  );

  const movements = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      reason: stockMovements.reason,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      locationName: locations.name,
      userName: user.name,
      ...movementCancelColumns,
    })
    .from(stockMovements)
    .innerJoin(locations, eq(stockMovements.locationId, locations.id))
    .leftJoin(user, eq(stockMovements.userId, user.id))
    .where(and(eq(stockMovements.productId, id), eq(stockMovements.businessId, ctx.business.id)))
    .orderBy(desc(stockMovements.createdAt))
    .limit(15);

  const showCost = ctx.can("costs.view");
  const current = perLocation.find((l) => l.locationId === ctx.location.id) ?? perLocation[0];

  return {
    ...p,
    costPrice: showCost ? p.costPrice : null,
    imageUrl: p.hasImage ? productImageUrl(p.id, p.updatedAt) : null,
    archived: p.archivedAt !== null,
    perLocation,
    current,
    movements,
    hasHistory: await productHasHistory(db, p.id),
  };
}

/**
 * Le produit a déjà servi : vendu, acheté, mis dans un devis ou bougé en stock (autre que son stock de départ).
 * On ne peut alors plus l'effacer sans fausser les rapports : on l'archive.
 */
export async function productHasHistory(tx: DbOrTx, productId: string) {
  const res = await tx.execute<{ used: boolean }>(sql`select (
    exists (select 1 from ${saleItems} where ${saleItems.productId} = ${productId})
    or exists (select 1 from ${purchaseItems} where ${purchaseItems.productId} = ${productId})
    or exists (select 1 from ${documentItems} where ${documentItems.productId} = ${productId})
    or exists (select 1 from ${stockMovements} where ${stockMovements.productId} = ${productId} and ${stockMovements.type} <> 'initial')
  ) as used`);
  return Boolean(res.rows[0]?.used);
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

/** Pour le formulaire de modification (inclut les champs bruts). */
export async function getProductForEdit(ctx: BusinessContext, id: string) {
  const [p] = await db
    .select({
      id: products.id,
      name: products.name,
      reference: products.reference,
      unit: products.unit,
      categoryId: products.categoryId,
      salePrice: products.salePrice,
      costPrice: products.costPrice,
      alertThreshold: products.alertThreshold,
      imageData: products.imageData,
      archivedAt: products.archivedAt,
      /** Quantité en rayon dans la boutique en cours (corrigeable dans le formulaire). */
      physical: sql<number>`coalesce(${stockLevels.quantity}, 0)::float8`,
    })
    .from(products)
    .leftJoin(stockLevels, and(eq(stockLevels.productId, products.id), eq(stockLevels.locationId, ctx.location.id)))
    .where(and(eq(products.id, id), eq(products.businessId, ctx.business.id)));
  return p ? { ...p, physical: Number(p.physical) } : null;
}

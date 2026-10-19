import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { DbOrTx, Tx } from "@/db";
import { saleItems, sales, stockLevels, stockMovements } from "@/db/schema";
import { RESERVING_STATUSES } from "@/lib/domain/orders";
import { roundQty, type MovementType } from "@/lib/domain/stock";

export interface MovementInput {
  businessId: string;
  locationId: string;
  productId: string;
  /** positive = entrée, négative = sortie */
  quantity: number;
  type: MovementType;
  reason?: string | null;
  refType?: string | null;
  refId?: string | null;
  unitCost?: number | null;
  note?: string | null;
  userId?: string | null;
}

/** Seul point d'entrée pour modifier le stock : met à jour la quantité et journalise le mouvement. */
export async function applyStockMovement(tx: Tx, m: MovementInput): Promise<number> {
  const quantity = roundQty(m.quantity);
  const [row] = await tx
    .insert(stockLevels)
    .values({ businessId: m.businessId, productId: m.productId, locationId: m.locationId, quantity })
    .onConflictDoUpdate({
      target: [stockLevels.productId, stockLevels.locationId],
      set: { quantity: sql`${stockLevels.quantity} + ${quantity}` },
    })
    .returning({ quantity: stockLevels.quantity });

  await tx.insert(stockMovements).values({
    businessId: m.businessId,
    locationId: m.locationId,
    productId: m.productId,
    type: m.type,
    quantity,
    reason: m.reason ?? null,
    refType: m.refType ?? null,
    refId: m.refId ?? null,
    unitCost: m.unitCost ?? null,
    note: m.note ?? null,
    userId: m.userId ?? null,
  });
  return Number(row!.quantity);
}

/**
 * Verrouille les lignes de stock des produits (évite deux ventes simultanées du dernier article)
 * et renvoie la quantité physique de chacun.
 */
export async function lockStock(
  tx: Tx,
  businessId: string,
  locationId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map();
  await tx
    .insert(stockLevels)
    .values(ids.map((productId) => ({ businessId, productId, locationId, quantity: 0 })))
    .onConflictDoNothing();
  const rows = await tx
    .select({ productId: stockLevels.productId, quantity: stockLevels.quantity })
    .from(stockLevels)
    .where(and(eq(stockLevels.locationId, locationId), inArray(stockLevels.productId, ids)))
    .for("update");
  return new Map(rows.map((r) => [r.productId, Number(r.quantity)]));
}

/** Quantités réservées par les commandes en ligne non encore expédiées. */
export async function reservedQuantities(
  db: DbOrTx,
  businessId: string,
  locationId: string,
  productIds?: string[],
  excludeSaleId?: string,
): Promise<Map<string, number>> {
  const conditions = [
    eq(sales.businessId, businessId),
    eq(sales.locationId, locationId),
    eq(sales.kind, "order"),
    inArray(sales.status, [...RESERVING_STATUSES]),
  ];
  if (productIds) {
    if (productIds.length === 0) return new Map();
    conditions.push(inArray(saleItems.productId, productIds));
  }
  if (excludeSaleId) conditions.push(ne(sales.id, excludeSaleId));
  const rows = await db
    .select({ productId: saleItems.productId, reserved: sql<string>`sum(${saleItems.quantity})` })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(...conditions))
    .groupBy(saleItems.productId);
  return new Map(rows.filter((r) => r.productId).map((r) => [r.productId!, Number(r.reserved)]));
}

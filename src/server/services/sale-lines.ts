import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Tx } from "@/db";
import { customers, products } from "@/db/schema";
import { formatQty, unitAllowsDecimals } from "@/lib/format";
import { roundQty } from "@/lib/domain/stock";
import { ActionError } from "../action";
import type { BusinessContext } from "../context";
import { lockStock, reservedQuantities } from "./stock";

export interface LineInput {
  productId: string;
  quantity: number;
}

export interface PricedLine {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
}

/**
 * Prépare les lignes d'une vente ou commande : les prix viennent de la base (jamais du navigateur),
 * le stock est verrouillé et la disponibilité vérifiée.
 */
export async function priceAndReserve(
  tx: Tx,
  ctx: BusinessContext,
  lines: LineInput[],
  opts: { excludeSaleId?: string } = {},
): Promise<PricedLine[]> {
  // Regroupe les doublons
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.productId, roundQty((merged.get(l.productId) ?? 0) + l.quantity));
  const ids = [...merged.keys()];

  const rows = await tx
    .select({
      id: products.id,
      name: products.name,
      unit: products.unit,
      salePrice: products.salePrice,
      costPrice: products.costPrice,
    })
    .from(products)
    .where(and(eq(products.businessId, ctx.business.id), inArray(products.id, ids), isNull(products.archivedAt)));
  if (rows.length !== ids.length) throw new ActionError("Un des produits est introuvable ou archivé.");

  const physical = await lockStock(tx, ctx.business.id, ctx.location.id, ids);
  const reserved = await reservedQuantities(tx, ctx.business.id, ctx.location.id, ids, opts.excludeSaleId);

  return rows.map((p) => {
    const quantity = merged.get(p.id)!;
    if (!unitAllowsDecimals(p.unit) && !Number.isInteger(quantity)) {
      throw new ActionError(`« ${p.name} » se vend en unités entières.`);
    }
    const available = roundQty((physical.get(p.id) ?? 0) - (reserved.get(p.id) ?? 0));
    if (quantity > available) {
      throw new ActionError(
        available > 0
          ? `Stock insuffisant pour « ${p.name} » : il n'en reste que ${formatQty(available, p.unit)}.`
          : `« ${p.name} » est en rupture de stock.`,
      );
    }
    return {
      productId: p.id,
      name: p.name,
      unit: p.unit,
      quantity,
      unitPrice: p.salePrice,
      unitCost: p.costPrice,
      lineTotal: Math.round(quantity * p.salePrice),
    };
  });
}

export async function assertCustomer(tx: Tx, businessId: string, customerId: string | null | undefined) {
  if (!customerId) return null;
  const [c] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.businessId, businessId)));
  if (!c) throw new ActionError("Client introuvable.");
  return c.id;
}

import { roundQty } from "@/lib/domain/stock";
import type { OutboxSale } from "./types";

/** Quantités des ventes encore dans le téléphone, par produit, pour un commerce et une boutique. */
export function pendingQuantities(outbox: OutboxSale[], businessId: string, locationId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const sale of outbox) {
    if (sale.status !== "pending" || sale.businessId !== businessId || sale.locationId !== locationId) continue;
    for (const i of sale.items) out.set(i.productId, roundQty((out.get(i.productId) ?? 0) + i.quantity));
  }
  return out;
}

/** Disponible affiché : celui du serveur (ou de la copie) moins les ventes pas encore envoyées. */
export function localAvailability<T extends { id: string; available: number }>(
  products: T[],
  outbox: OutboxSale[],
  businessId: string,
  locationId: string,
): T[] {
  const pending = pendingQuantities(outbox, businessId, locationId);
  if (pending.size === 0) return products;
  return products.map((p) => {
    const sold = pending.get(p.id);
    return sold ? { ...p, available: roundQty(p.available - sold) } : p;
  });
}

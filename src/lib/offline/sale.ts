import type { SaleMethod } from "@/lib/domain/sales";
import { roundQty } from "@/lib/domain/stock";
import type { OfflineIdentity, OfflineSnapshot, OutboxItem, OutboxSale, SaleDraft } from "./types";

/** Total d'une ligne, arrondi au franc comme sur le serveur. */
export function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice);
}

/** Mêmes calculs que le serveur : remise plafonnée au sous-total, rien d'encaissé pour un crédit. */
export function saleTotals(
  items: Pick<OutboxItem, "quantity" | "unitPrice">[],
  discount: number,
  paymentMethod: SaleMethod,
  amountReceived: number,
): { subtotal: number; total: number; amountPaid: number } {
  const subtotal = items.reduce((s, i) => s + lineTotal(i.quantity, i.unitPrice), 0);
  const total = subtotal - Math.min(Math.max(0, discount), subtotal);
  const amountPaid = paymentMethod === "credit" ? 0 : Math.min(Math.max(0, amountReceived), total);
  return { subtotal, total, amountPaid };
}

/**
 * Le prix a-t-il changé entre la vente et son envoi ? Un prix négocié à la caisse est voulu : il ne compte pas.
 */
export function unexpectedPriceChange(
  items: { productId: string; unitPrice: number; negotiated?: boolean }[],
  salePrices: Map<string, number>,
): boolean {
  return items.some((i) => !i.negotiated && salePrices.has(i.productId) && salePrices.get(i.productId) !== i.unitPrice);
}

/** Regroupe les lignes d'un même produit (comme le serveur) et retire les quantités nulles. */
export function mergeItems(items: OutboxItem[]): OutboxItem[] {
  const merged = new Map<string, OutboxItem>();
  for (const i of items) {
    const prev = merged.get(i.productId);
    merged.set(
      i.productId,
      prev
        ? { ...prev, quantity: roundQty(prev.quantity + i.quantity), ...(prev.negotiated || i.negotiated ? { negotiated: true } : {}) }
        : { ...i, quantity: roundQty(i.quantity) },
    );
  }
  return [...merged.values()].filter((i) => i.quantity > 0);
}

export function buildOutboxSale(draft: SaleDraft, identity: OfflineIdentity, localNumber: number, now: Date): OutboxSale {
  return {
    clientRef: draft.clientRef,
    userId: identity.userId,
    businessId: identity.businessId,
    locationId: identity.locationId,
    createdAt: now.toISOString(),
    localNumber,
    items: mergeItems(draft.items),
    discount: Math.max(0, Math.round(draft.discount)),
    paymentMethod: draft.paymentMethod,
    amountReceived: Math.max(0, Math.round(draft.amountReceived)),
    customerId: draft.customer?.id ?? null,
    customerName: draft.customer?.name ?? null,
    customerPhone: draft.customer?.phone ?? null,
    status: "pending",
    error: null,
    attempts: 0,
    serverId: null,
    serverNumber: null,
    sentAt: null,
  };
}

/** Numéro provisoire affiché sur le reçu d'une vente pas encore envoyée. */
export function offlineLabel(localNumber: number): string {
  return `Hors ligne n° ${localNumber}`;
}

/** La copie permet-elle de vendre (droit de vente, caisse activée, formule encore valable) ? */
export function canSellOffline(snapshot: OfflineSnapshot, now: Date): boolean {
  if (!snapshot.modulePos || !snapshot.can.sell || snapshot.plan.readOnly) return false;
  return snapshot.plan.sellUntil === null || now.getTime() < new Date(snapshot.plan.sellUntil).getTime();
}

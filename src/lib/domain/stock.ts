export function roundQty(quantity: number): number {
  return Math.round(quantity * 1000) / 1000;
}

/** Coût moyen pondéré après une entrée de stock, arrondi au franc. */
export function weightedAverageCost(
  currentQty: number,
  currentCost: number,
  incomingQty: number,
  incomingCost: number,
): number {
  if (incomingQty <= 0) return currentCost;
  if (currentQty <= 0) return Math.round(incomingCost);
  return Math.round((currentQty * currentCost + incomingQty * incomingCost) / (currentQty + incomingQty));
}

export type StockStatus = "ok" | "low" | "out";

export function stockStatus(available: number, alertThreshold: number): StockStatus {
  if (available <= 0) return "out";
  if (available <= alertThreshold) return "low";
  return "ok";
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: "En stock",
  low: "Stock bas",
  out: "Rupture",
};

export const MOVEMENT_TYPES = {
  initial: "Stock de départ",
  purchase: "Entrée / achat",
  sale: "Vente",
  sale_cancel: "Vente annulée",
  order_out: "Commande expédiée",
  order_return: "Commande retournée",
  out: "Sortie",
  adjust: "Ajustement",
  inventory: "Inventaire",
  transfer_out: "Transfert sortant",
  transfer_in: "Transfert entrant",
} as const;

export type MovementType = keyof typeof MOVEMENT_TYPES;

/** Motifs d'une sortie manuelle (le produit n'est pas perdu). */
export const EXIT_REASONS = {
  sold_offline: "Vendu hors caisse",
  used: "Utilisé",
  gift: "Offert",
  other: "Autre",
} as const;

/** Motifs d'une perte, comptabilisée dans les rapports de pertes. */
export const LOSS_REASONS = {
  breakage: "Casse",
  theft: "Vol",
  loss: "Perte",
  expired: "Péremption",
  entry_error: "Erreur de saisie",
} as const;

export type ExitReason = keyof typeof EXIT_REASONS;
export type LossReason = keyof typeof LOSS_REASONS;

export const REASON_LABELS: Record<string, string> = { ...EXIT_REASONS, ...LOSS_REASONS, inventory: "Inventaire" };

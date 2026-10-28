/** Ce que l'administrateur regarde avant de restaurer une boutique. */
const WATCHED = [
  ["sales", "Ventes"],
  ["documents", "Devis et factures"],
  ["customers", "Clients"],
  ["products", "Produits"],
  ["purchases", "Entrées de stock"],
  ["stockMovements", "Mouvements de stock"],
  ["customerPayments", "Paiements de clients"],
  ["members", "Membres de l'équipe"],
] as const;

export interface ImpactLine {
  key: string;
  label: string;
  now: number;
  after: number;
  diff: number;
}

export function restoreImpact(saved: Record<string, number>, current: Record<string, number>): ImpactLine[] {
  return WATCHED.map(([key, label]) => {
    const now = current[key] ?? 0;
    const after = saved[key] ?? 0;
    return { key, label, now, after, diff: after - now };
  });
}

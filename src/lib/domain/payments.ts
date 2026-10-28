/** Part d'un remboursement de dette imputée à une vente. */
export interface Allocation {
  saleId: string;
  amount: number;
}

/** Répartit un remboursement sur les ventes impayées, des plus anciennes aux plus récentes (déjà triées). */
export function allocatePayment(amount: number, unpaid: { id: string; total: number; amountPaid: number }[]): Allocation[] {
  const parts: Allocation[] = [];
  let remaining = amount;
  for (const sale of unpaid) {
    if (remaining <= 0) break;
    const part = Math.min(remaining, sale.total - sale.amountPaid);
    if (part <= 0) continue;
    parts.push({ saleId: sale.id, amount: part });
    remaining -= part;
  }
  return parts;
}

/**
 * Ce qu'il faut retirer du « payé » de chaque vente pour annuler un remboursement. Avec sa répartition : exactement
 * elle (une vente annulée depuis est ignorée). Sans (paiement d'avant la répartition) : d'abord les ventes à crédit,
 * puis les autres, des plus récentes aux plus anciennes ; la dette totale du client redevient exacte.
 */
export function paymentReversal(
  amount: number,
  allocations: Allocation[] | null,
  sales: { id: string; amountPaid: number; credit: boolean; completedAt: Date | string }[],
): Allocation[] {
  const paid = new Map(sales.map((s) => [s.id, s.amountPaid]));
  if (allocations) {
    return allocations.flatMap((a) => {
      const part = Math.min(a.amount, paid.get(a.saleId) ?? 0);
      return part > 0 ? [{ saleId: a.saleId, amount: part }] : [];
    });
  }
  const order = [...sales].sort(
    (a, b) => Number(b.credit) - Number(a.credit) || new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
  const parts: Allocation[] = [];
  let remaining = amount;
  for (const sale of order) {
    if (remaining <= 0) break;
    const part = Math.min(remaining, sale.amountPaid);
    if (part <= 0) continue;
    parts.push({ saleId: sale.id, amount: part });
    remaining -= part;
  }
  return parts;
}

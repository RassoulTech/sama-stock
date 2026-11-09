// src/lib/domain/assistant/money.ts
/** Total d'une ligne en FCFA entiers (pas de centimes) : 1,5 kg à 600 F = 900 F. */
export function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice);
}

// src/lib/domain/assistant/catalogue.ts
import type { StockStatus } from "@/lib/domain/stock";

export interface ProduitResume {
  name: string;
  available: number;
  status: StockStatus;
  salePrice: number;
  costPrice: number | null;
}

/** Au-delà, l'assistant dit « et d'autres » : une liste trop longue ne se lit pas à voix haute. */
const NOMS_MAX = 8;

/** État du catalogue pour l'assistant : combien de produits, en stock, bas, en rupture, et la valeur du stock. */
export function resumeCatalogue(produits: readonly ProduitResume[], opts: { costs: boolean }): Record<string, unknown> {
  const bas = produits.filter((p) => p.status === "low");
  const rupture = produits.filter((p) => p.status === "out");
  const valeur = (prix: (p: ProduitResume) => number) => Math.round(produits.reduce((s, p) => s + Math.max(0, p.available) * prix(p), 0));
  return {
    nombre_produits: produits.length,
    en_stock: produits.length - bas.length - rupture.length,
    stock_bas: bas.length,
    ruptures: rupture.length,
    produits_stock_bas: bas.slice(0, NOMS_MAX).map((p) => p.name),
    produits_en_rupture: rupture.slice(0, NOMS_MAX).map((p) => p.name),
    valeur_stock_prix_vente: valeur((p) => p.salePrice),
    ...(opts.costs ? { valeur_stock_prix_achat: valeur((p) => p.costPrice ?? 0) } : {}),
  };
}

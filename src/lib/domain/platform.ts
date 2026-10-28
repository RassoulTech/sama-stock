/** Santé de la plateforme : la place prise dans la base, comparée à l'offre gratuite de Neon. */

/** Offre gratuite de Neon : 1 Go par base. */
export const NEON_FREE_STORAGE_BYTES = 1024 ** 3;

export type StorageLevel = "ok" | "attention" | "urgent";

export function storageLevel(bytes: number, limit = NEON_FREE_STORAGE_BYTES): StorageLevel {
  const ratio = bytes / limit;
  if (ratio >= 0.9) return "urgent";
  if (ratio >= 0.7) return "attention";
  return "ok";
}

/** Message d'alerte (une panne « plateforme ») à partir de 70 %, plus pressant à 90 %. */
export function storageAlert(bytes: number, limit = NEON_FREE_STORAGE_BYTES): string | null {
  const level = storageLevel(bytes, limit);
  if (level === "ok") return null;
  const pct = Math.floor((bytes / limit) * 100);
  return level === "urgent"
    ? `Base de données presque pleine : ${pct} %. Passez Neon à l'offre payante maintenant, sinon les ventes s'arrêteront.`
    : `Base de données remplie à ${pct} % de l'offre gratuite : prévoyez l'offre payante de Neon.`;
}

/** Noms lisibles des tables qui grossissent. */
export const TABLE_LABELS: Record<string, string> = {
  sales: "Ventes",
  sale_items: "Lignes de vente",
  stock_movements: "Mouvements de stock",
  products: "Produits (avec leurs photos)",
  businesses: "Commerces (avec leurs logos)",
  customers: "Clients",
  customer_payments: "Paiements de clients",
  documents: "Devis et factures",
  document_items: "Lignes de devis et factures",
  purchases: "Entrées de stock",
  purchase_items: "Lignes d'entrées de stock",
  stock_levels: "Stock par boutique",
  notifications: "Notifications",
  session: "Connexions ouvertes",
  user: "Utilisateurs",
  account: "Comptes de connexion",
  admin_audit_log: "Journal admin",
  app_errors: "Pannes",
  members: "Équipes",
  rate_limit: "Anti-essais de mots de passe",
};

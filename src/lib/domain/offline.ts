/** Points à vérifier relevés quand une vente faite sans internet arrive sur le serveur. */
export const SYNC_FLAGS = {
  stock_negatif: {
    label: "Stock insuffisant",
    text: "Pendant la coupure, plus d'articles ont été vendus que le stock disponible (commandes réservées comprises). Vérifiez le stock et les commandes en cours.",
  },
  prix_modifie: {
    label: "Prix différent",
    text: "Le prix de vente a changé entre la vente et son envoi. Le client a payé le prix affiché au moment de la vente.",
  },
  client_introuvable: {
    label: "Client introuvable",
    text: "Le client choisi a été supprimé entre-temps : la vente a été gardée sans client.",
  },
  credit_sans_client: {
    label: "Crédit sans client",
    text: "Il reste un montant à payer, mais aucun client n'est rattaché à la vente.",
  },
} as const;

export type SyncFlag = keyof typeof SYNC_FLAGS;

export function isSyncFlag(value: string): value is SyncFlag {
  return value in SYNC_FLAGS;
}

export function computeSyncFlags(f: {
  negativeStock: boolean;
  priceChanged: boolean;
  customerMissing: boolean;
  creditWithoutCustomer: boolean;
}): SyncFlag[] {
  const flags: SyncFlag[] = [];
  if (f.negativeStock) flags.push("stock_negatif");
  if (f.priceChanged) flags.push("prix_modifie");
  if (f.customerMissing) flags.push("client_introuvable");
  if (f.creditWithoutCustomer) flags.push("credit_sans_client");
  return flags;
}

/** Tolérance pour l'horloge d'un téléphone un peu en avance. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Ramène l'heure d'une vente dans un intervalle plausible (horloge du téléphone fausse). */
export function clampSaleDate(createdAt: Date, now: Date, notBefore: Date): Date {
  if (Number.isNaN(createdAt.getTime())) return now;
  if (createdAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return now;
  if (createdAt.getTime() < notBefore.getTime()) return notBefore;
  return createdAt;
}

export const PAYMENT_METHODS = {
  cash: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  card: "Carte bancaire",
  credit: "À crédit",
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

/**
 * Modes proposés pour un remboursement ou un paiement (pas « à crédit ») : espèces et mobile money.
 * Free Money et carte restent dans PAYMENT_METHODS uniquement pour afficher les anciennes ventes.
 */
export const PAYING_METHODS = ["cash", "wave", "orange_money"] as const satisfies readonly PaymentMethod[];

/** Modes proposés à la caisse. */
export const SALE_METHODS = [...PAYING_METHODS, "credit"] as const satisfies readonly PaymentMethod[];
export type SaleMethod = (typeof SALE_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value in PAYMENT_METHODS;
}

export const CHANNELS = {
  boutique: "Boutique",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  site: "Site web",
  telephone: "Téléphone",
  autre: "Autre",
} as const;

export type Channel = keyof typeof CHANNELS;

/** Canaux proposés pour une commande en ligne. */
export const ORDER_CHANNELS = ["whatsapp", "instagram", "tiktok", "facebook", "site", "telephone", "autre"] as const satisfies readonly Channel[];

export function isChannel(value: string): value is Channel {
  return value in CHANNELS;
}

export const ACTIVITIES = {
  ecommerce: "E-commerce (WhatsApp, Instagram, TikTok…)",
  boutique: "Boutique",
  quincaillerie: "Quincaillerie",
  autre: "Autre",
} as const;

export type Activity = keyof typeof ACTIVITIES;

export function isActivity(value: string): value is Activity {
  return value in ACTIVITIES;
}

/** Modules activés par défaut selon le type d'activité (cahier des charges § 3.11). */
export function defaultModules(activity: Activity): { modulePos: boolean; moduleOrders: boolean } {
  switch (activity) {
    case "ecommerce":
      return { modulePos: false, moduleOrders: true };
    case "boutique":
    case "quincaillerie":
      return { modulePos: true, moduleOrders: false };
    default:
      return { modulePos: true, moduleOrders: true };
  }
}

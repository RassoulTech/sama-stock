export const PAYMENT_METHODS = {
  cash: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  card: "Carte bancaire",
  credit: "À crédit",
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

/** Modes utilisables pour un remboursement ou un paiement (pas « à crédit »). */
export const PAYING_METHODS = ["cash", "wave", "orange_money", "free_money", "card"] as const satisfies readonly PaymentMethod[];

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

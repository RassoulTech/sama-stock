/**
 * Valeurs de la colonne `businesses.plan`. Sama Stock se vend uniquement en licence (achetée une fois, installée chez
 * le client) : « pro » et « business » ne servent plus qu'à reconnaître les boutiques de démonstration.
 */
export type PlanId = "trial" | "pro" | "business";

export interface PlanLimits {
  /** null = illimité */
  maxProducts: number | null;
  maxEmployees: number | null;
  maxLocations: number;
  advancedReports: boolean;
  /** Import des produits et export des rapports au format Excel. */
  excel: boolean;
}

export const TRIAL_DAYS = 14;

/** Essai gratuit : découvrir Sama Stock pendant 14 jours avant d'acheter sa licence. */
export const TRIAL: { label: string; tagline: string; limits: PlanLimits } = {
  label: "Essai gratuit",
  tagline: "14 jours pour découvrir Sama Stock",
  limits: { maxProducts: 20, maxEmployees: 0, maxLocations: 1, advancedReports: false, excel: false },
};

/**
 * Licences : l'application est achetée une fois (installation et personnalisation comprises)
 * et ne s'arrête jamais. La maintenance (assistance, nouveautés, sauvegardes) est comprise les
 * 6 premiers mois, puis renouvelable tous les 6 mois.
 */
export type LicensePackId = "boutique" | "pro" | "business";

export interface LicensePack {
  id: LicensePackId;
  label: string;
  /** Prix catalogue, négociable à chaque vente. */
  price: number;
  /** Prix de 6 mois de maintenance, après les 6 premiers mois. */
  maintenancePrice: number;
  tagline: string;
  limits: PlanLimits;
}

export const LICENSE_PACKS: Record<LicensePackId, LicensePack> = {
  boutique: {
    id: "boutique",
    label: "Boutique",
    price: 50_000,
    maintenancePrice: 15_000,
    tagline: "Une boutique, le propriétaire seul",
    limits: { maxProducts: null, maxEmployees: 0, maxLocations: 1, advancedReports: true, excel: true },
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: 75_000,
    maintenancePrice: 20_000,
    tagline: "Une boutique avec ses employés",
    limits: { maxProducts: null, maxEmployees: 5, maxLocations: 1, advancedReports: true, excel: true },
  },
  business: {
    id: "business",
    label: "Business",
    price: 90_000,
    maintenancePrice: 25_000,
    tagline: "Plusieurs boutiques ou dépôts",
    limits: { maxProducts: null, maxEmployees: null, maxLocations: 5, advancedReports: true, excel: true },
  },
};

export const LICENSE_ORDER: LicensePackId[] = ["boutique", "pro", "business"];

/** Maintenance comprise dans l'achat d'une licence. */
export const MAINTENANCE_INCLUDED_MONTHS = 6;
/** Durée achetée à chaque renouvellement de la maintenance (au prix `maintenancePrice`). */
export const MAINTENANCE_PERIOD_MONTHS = 6;
/** « par 6 mois », à côté d'un prix de maintenance. */
export const MAINTENANCE_PERIOD_LABEL = `par ${MAINTENANCE_PERIOD_MONTHS} mois`;

export function isLicensePack(value: unknown): value is LicensePackId {
  return value === "boutique" || value === "pro" || value === "business";
}

/** Date + n mois (même jour du mois quand c'est possible). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export type PlanStatus = "trialing" | "active" | "expired" | "suspended";

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  trialing: "Essai en cours",
  active: "Actif",
  expired: "Expiré",
  suspended: "Suspendu",
};

export const PLAN_STATUS_TONES: Record<PlanStatus, "green" | "saffron" | "red" | "blue"> = {
  trialing: "blue",
  active: "green",
  expired: "saffron",
  suspended: "red",
};

export interface PlanState {
  plan: PlanId;
  label: string;
  status: PlanStatus;
  readOnly: boolean;
  /** Essai : jours restants. Licence : jours de maintenance restants. */
  daysLeft: number;
  /** Essai : fin de l'essai. Licence : fin de la maintenance. */
  endsAt: Date | null;
  limits: PlanLimits;
  /** Licence achetée (l'application n'expire jamais), ou null pendant l'essai gratuit. */
  license: LicensePackId | null;
}

export function isPlanId(value: string): value is PlanId {
  return value === "trial" || value === "pro" || value === "business";
}

export function computePlanState(
  b: {
    plan: string;
    trialEndsAt: Date | null;
    periodEndsAt?: Date | null;
    suspendedAt: Date | null;
    licensePack?: string | null;
    maintenanceEndsAt?: Date | null;
  },
  now: Date = new Date(),
): PlanState {
  const plan: PlanId = isPlanId(b.plan) ? b.plan : "trial";

  // Licence achetée : jamais d'expiration ; seule une suspension bloque l'accès
  if (isLicensePack(b.licensePack)) {
    const pack = LICENSE_PACKS[b.licensePack];
    const endsAt = b.maintenanceEndsAt ?? null;
    const msLeft = endsAt ? endsAt.getTime() - now.getTime() : 0;
    const status: PlanStatus = b.suspendedAt ? "suspended" : "active";
    return {
      plan,
      label: `Licence ${pack.label}`,
      status,
      readOnly: status === "suspended",
      daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
      endsAt,
      limits: { ...pack.limits },
      license: pack.id,
    };
  }

  // Sans licence : l'essai gratuit (fini à sa date de fin)
  const endsAt = b.trialEndsAt;
  const msLeft = endsAt ? endsAt.getTime() - now.getTime() : 0;
  const status: PlanStatus = b.suspendedAt ? "suspended" : msLeft > 0 ? "trialing" : "expired";
  return {
    plan: "trial",
    label: TRIAL.label,
    status,
    readOnly: status === "expired" || status === "suspended",
    daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
    endsAt,
    limits: { ...TRIAL.limits },
    license: null,
  };
}

/** true si l'on peut encore ajouter un élément (limit null = illimité). */
export function canAdd(limit: number | null, current: number): boolean {
  return limit === null || current < limit;
}

export function formatLimit(limit: number | null): string {
  return limit === null ? "Illimité" : String(limit);
}

/** « 50 produits », « Produits illimités » (ou « produits illimités » au milieu d'une phrase). */
export function limitLabel(limit: number | null, noun: string, opts: { lowercase?: boolean } = {}): string {
  if (limit !== null) return `${limit} ${noun}`;
  const text = `${noun} illimités`;
  return opts.lowercase ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** Ce que comprend une licence, dans l'ordre affiché (site, page « Licence », démo). */
export function licenceFeatures(pack: LicensePack): string[] {
  const l = pack.limits;
  return [
    limitLabel(l.maxProducts, "produits"),
    l.maxEmployees === 0 ? "Propriétaire seul" : limitLabel(l.maxEmployees, "employés"),
    `${l.maxLocations} boutique${l.maxLocations > 1 ? "s ou dépôts" : ""}`,
    "Caisse, commandes, crédits, inventaire",
    "Rapports avancés, import et export Excel",
    "Installation, logo et couleurs compris",
    "Import de vos produits et formation",
    `${MAINTENANCE_INCLUDED_MONTHS} mois d'assistance compris`,
  ];
}

/** Démonstration publique : chaque boutique fictive montre une licence (la colonne `plan` sert de clé de démo). */
export const DEMO_LICENCE: Record<PlanId, LicensePackId> = { trial: "boutique", pro: "pro", business: "business" };

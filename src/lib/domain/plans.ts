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

export interface PlanDefinition extends PlanLimits {
  id: PlanId;
  label: string;
  price: number;
  tagline: string;
}

export const TRIAL_DAYS = 14;
export const PERIOD_DAYS = 30;

export const PLANS: Record<PlanId, PlanDefinition> = {
  trial: {
    id: "trial",
    label: "Essai",
    price: 0,
    tagline: "14 jours pour découvrir Sama Stock",
    maxProducts: 20,
    maxEmployees: 0,
    maxLocations: 1,
    advancedReports: false,
    excel: false,
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: 6500,
    tagline: "Pour le commerçant qui travaille avec une petite équipe",
    maxProducts: 50,
    maxEmployees: 3,
    maxLocations: 1,
    advancedReports: true,
    excel: true,
  },
  business: {
    id: "business",
    label: "Business",
    price: 11500,
    tagline: "Pour les commerces qui grandissent, sur plusieurs boutiques",
    maxProducts: null,
    maxEmployees: null,
    maxLocations: 3,
    advancedReports: true,
    excel: true,
  },
};

export const PAID_PLANS = [PLANS.pro, PLANS.business];

/**
 * Licences : l'application est achetée une fois (installation et personnalisation comprises)
 * et ne s'arrête jamais. La maintenance (assistance, nouveautés, sauvegardes) est comprise la
 * première année, puis renouvelable chaque année.
 */
export type LicensePackId = "boutique" | "pro" | "business";

export interface LicensePack {
  id: LicensePackId;
  label: string;
  /** Prix catalogue, négociable à chaque vente. */
  price: number;
  /** Maintenance annuelle après la première année. */
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
export const MAINTENANCE_INCLUDED_MONTHS = 12;

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
  /** Abonnement ou essai : jours restants. Licence : jours de maintenance restants. */
  daysLeft: number;
  /** Abonnement ou essai : fin de période. Licence : fin de la maintenance. */
  endsAt: Date | null;
  limits: PlanLimits;
  /** Licence achetée (l'application n'expire jamais), ou null pour un abonnement. */
  license: LicensePackId | null;
}

export function isPlanId(value: string): value is PlanId {
  return value === "trial" || value === "pro" || value === "business";
}

export function computePlanState(
  b: {
    plan: string;
    trialEndsAt: Date | null;
    periodEndsAt: Date | null;
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

  const def = PLANS[plan];
  const endsAt = plan === "trial" ? b.trialEndsAt : b.periodEndsAt;
  const msLeft = endsAt ? endsAt.getTime() - now.getTime() : 0;

  let status: PlanStatus;
  if (b.suspendedAt) status = "suspended";
  else if (msLeft > 0) status = plan === "trial" ? "trialing" : "active";
  else status = "expired";

  const limits: PlanLimits = {
    maxProducts: def.maxProducts,
    maxEmployees: def.maxEmployees,
    maxLocations: def.maxLocations,
    advancedReports: def.advancedReports,
    excel: def.excel,
  };
  return {
    plan,
    label: def.label,
    status,
    readOnly: status === "expired" || status === "suspended",
    daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
    endsAt,
    limits,
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

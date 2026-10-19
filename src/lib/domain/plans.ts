export type PlanId = "trial" | "pro" | "business";

export interface PlanLimits {
  /** null = illimité */
  maxProducts: number | null;
  maxEmployees: number | null;
  maxLocations: number;
  advancedReports: boolean;
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
  },
};

export const PAID_PLANS = [PLANS.pro, PLANS.business];

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
  daysLeft: number;
  endsAt: Date | null;
  limits: PlanLimits;
}

export function isPlanId(value: string): value is PlanId {
  return value === "trial" || value === "pro" || value === "business";
}

export function computePlanState(
  b: { plan: string; trialEndsAt: Date | null; periodEndsAt: Date | null; suspendedAt: Date | null },
  now: Date = new Date(),
): PlanState {
  const plan: PlanId = isPlanId(b.plan) ? b.plan : "trial";
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
  };
  return {
    plan,
    label: def.label,
    status,
    readOnly: status === "expired" || status === "suspended",
    daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
    endsAt,
    limits,
  };
}

/** true si l'on peut encore ajouter un élément (limit null = illimité). */
export function canAdd(limit: number | null, current: number): boolean {
  return limit === null || current < limit;
}

export function formatLimit(limit: number | null): string {
  return limit === null ? "Illimité" : String(limit);
}

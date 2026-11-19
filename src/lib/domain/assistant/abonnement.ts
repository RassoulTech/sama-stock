// src/lib/domain/assistant/abonnement.ts
/**
 * Abonnement mensuel de Finch : état d'un commerce, placement des mois payés. Fonctions pures : le serveur leur passe
 * les fenêtres de crédits lues en base (1 crédit = 1 conversation).
 */
import { ASSISTANT_TRIAL_CREDITS, type LicensePackId, type PlanState } from "../plans";

export type GenreMois = "abonnement" | "essai";

/** Une fenêtre de crédits : un mois d'abonnement payé, ou l'essai gratuit. */
export interface MoisAssistant {
  id: string;
  kind: GenreMois;
  startsAt: Date;
  endsAt: Date;
  credits: number;
  /** Crédits des recharges du mois. */
  extraCredits: number;
  used: number;
}

export type StatutAssistant = "demo" | "essai" | "essai_epuise" | "actif" | "epuise" | "expire" | "inactif" | "indisponible";

export const STATUTS_ASSISTANT: Record<StatutAssistant, string> = {
  demo: "Démonstration",
  essai: "Essai gratuit",
  essai_epuise: "Essai terminé",
  actif: "Actif",
  epuise: "Crédits épuisés",
  expire: "Expiré",
  inactif: "Non activé",
  indisponible: "Indisponible",
};

export interface EtatAssistant {
  statut: StatutAssistant;
  /** Offre de la licence du commerce (null : essai ou démonstration sans licence). */
  offre: LicensePackId | null;
  /** Fenêtre qui couvre maintenant. */
  mois: MoisAssistant | null;
  restants: number;
  total: number;
  /** Fin du dernier mois d'abonnement (mois payés d'avance compris). */
  finLe: Date | null;
}

type PlanAssistant = Pick<PlanState, "status" | "license">;

const couvre = (m: MoisAssistant, now: Date) => m.startsAt.getTime() <= now.getTime() && m.endsAt.getTime() > now.getTime();
const totalDe = (m: MoisAssistant) => m.credits + m.extraCredits;
const resteDe = (m: MoisAssistant) => Math.max(0, totalDe(m) - m.used);

/** Le micro s'affiche pour une démonstration, une licence ou un essai en cours ; jamais pour un commerce suspendu. */
export function boutonAssistantVisible(plan: PlanAssistant, isDemo: boolean): boolean {
  if (plan.status === "suspended") return false;
  return isDemo || plan.license !== null || plan.status === "trialing";
}

/** Fin du dernier mois d'abonnement (l'essai ne compte pas). */
export function finAbonnement(mois: readonly MoisAssistant[]): Date | null {
  let fin: number | null = null;
  for (const m of mois) if (m.kind === "abonnement" && (fin === null || m.endsAt.getTime() > fin)) fin = m.endsAt.getTime();
  return fin === null ? null : new Date(fin);
}

/** Date + k mois, même jour quand il existe, sinon le dernier jour du mois (Dakar = UTC). */
export function moisPlus(date: Date, k: number): Date {
  const d = new Date(date);
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + k);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return d;
}

/**
 * n mois d'un mois à la suite, à partir de la fin du dernier mois d'abonnement s'il n'est pas fini, sinon de maintenant.
 * Calculés depuis le premier début, pour ne pas dériver en fin de mois.
 */
export function planifierMois(mois: readonly MoisAssistant[], n: number, now = new Date()): { startsAt: Date; endsAt: Date }[] {
  const fin = finAbonnement(mois);
  const debut = fin && fin.getTime() > now.getTime() ? fin : now;
  return Array.from({ length: n }, (_, k) => ({ startsAt: moisPlus(debut, k), endsAt: moisPlus(debut, k + 1) }));
}

/** Où en est Finch pour ce commerce. Sous licence, seuls les mois d'abonnement comptent. */
export function etatAssistant(
  input: { isDemo: boolean; plan: PlanAssistant; mois: readonly MoisAssistant[] },
  now = new Date(),
): EtatAssistant {
  const { isDemo, plan, mois } = input;
  const offre = plan.license;
  const finLe = finAbonnement(mois);
  const vide = { mois: null, restants: 0, total: 0 };
  if (!boutonAssistantVisible(plan, isDemo)) return { statut: "indisponible", offre, finLe, ...vide };
  if (isDemo) return { statut: "demo", offre, finLe, ...vide };

  if (offre !== null) {
    const enCours = mois.find((m) => m.kind === "abonnement" && couvre(m, now)) ?? null;
    if (enCours) {
      const restants = resteDe(enCours);
      return { statut: restants > 0 ? "actif" : "epuise", offre, finLe, mois: enCours, restants, total: totalDe(enCours) };
    }
    return { statut: finLe ? "expire" : "inactif", offre, finLe, ...vide };
  }

  // Essai gratuit : la fenêtre se crée à la première conversation
  const essai = mois.find((m) => m.kind === "essai") ?? null;
  if (!essai) return { statut: "essai", offre, finLe, mois: null, restants: ASSISTANT_TRIAL_CREDITS, total: ASSISTANT_TRIAL_CREDITS };
  const restants = couvre(essai, now) ? resteDe(essai) : 0;
  return { statut: restants > 0 ? "essai" : "essai_epuise", offre, finLe, mois: essai, restants, total: totalDe(essai) };
}

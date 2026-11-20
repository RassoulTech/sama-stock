// src/lib/domain/assistant/abonnement.ts
/**
 * Abonnement mensuel de Finch : état d'un commerce, placement des mois payés. Fonctions pures : le serveur leur passe
 * les fenêtres de crédits lues en base (1 crédit = 1 conversation).
 */
import { formatDate, formatFCFA } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import type { NotifyMessage } from "../notifications";
import {
  ASSISTANT_COST_PER_CONVERSATION,
  ASSISTANT_OFFERS,
  ASSISTANT_RECHARGE,
  ASSISTANT_TRIAL_CREDITS,
  LICENSE_PACKS,
  type LicensePackId,
  type PlanState,
} from "../plans";
import { NOM_ASSISTANT } from "./nom";

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
 * Chaque date se calcule depuis le début de la suite de mois (pas de fin en fin), pour ne pas dériver en fin de mois :
 * 31 janvier + 1 mois = 28 février, mais + 2 mois = 31 mars.
 */
export function planifierMois(mois: readonly MoisAssistant[], n: number, now = new Date()): { startsAt: Date; endsAt: Date }[] {
  const fin = finAbonnement(mois);
  let ancre = now;
  let k0 = 0;
  if (fin && fin.getTime() > now.getTime()) {
    // Par défaut (données anciennes ou saisies à la main) : on repart de la fin actuelle.
    ancre = fin;
    // Chaîne de mois d'abonnement qui finit à `fin` : chaque début est la fin du mois d'avant.
    const abonnements = mois.filter((m) => m.kind === "abonnement");
    const finDe = (t: number) => abonnements.find((m) => m.endsAt.getTime() === t);
    let courant = finDe(fin.getTime());
    let debut: Date | undefined;
    let taille = 0;
    while (courant && taille <= abonnements.length) {
      taille++;
      debut = courant.startsAt;
      courant = finDe(debut.getTime());
    }
    if (debut && moisPlus(debut, taille).getTime() === fin.getTime()) {
      ancre = debut;
      k0 = taille;
    }
  }
  return Array.from({ length: n }, (_, k) => ({ startsAt: moisPlus(ancre, k0 + k), endsAt: moisPlus(ancre, k0 + k + 1) }));
}

/** Le mois d'abonnement qui portait une recharge (celui qui couvrait sa date de paiement). */
export function moisDeRecharge(mois: readonly MoisAssistant[], paidAt: Date): MoisAssistant | null {
  return mois.find((m) => m.kind === "abonnement" && m.startsAt <= paidAt && m.endsAt > paidAt) ?? null;
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

const conv = (n: number) => `${n} conversation${n > 1 ? "s" : ""}`;

/** Fiche montrée à la place de la conversation quand Finch n'est pas payé ou n'a plus de crédits (null : Finch parle). */
export interface FicheAssistant {
  statut: StatutAssistant;
  titre: string;
  texte: string;
  /** Texte du bouton WhatsApp vers Sama Stock (null : pas de bouton). */
  bouton: string | null;
  lien: string | null;
}

export function ficheAssistant(etat: EtatAssistant, o: { boutique: string; peutPayer: boolean; support: string | null }): FicheAssistant | null {
  if (etat.statut === "demo" || etat.statut === "essai" || etat.statut === "actif") return null;
  if (!o.peutPayer) {
    return {
      statut: etat.statut,
      titre: `${NOM_ASSISTANT} n'est pas disponible`,
      texte: `${NOM_ASSISTANT} n'est pas disponible pour le moment : préviens le propriétaire de la boutique.`,
      bouton: null,
      lien: null,
    };
  }
  const pack = etat.offre ?? "boutique";
  const offre = ASSISTANT_OFFERS[pack];
  const licence = LICENSE_PACKS[pack].label;
  let titre: string;
  let texte: string;
  let bouton: string;
  let message: string;
  switch (etat.statut) {
    case "inactif":
      titre = `${NOM_ASSISTANT}, ton employé qui parle wolof`;
      texte = `Avec ta licence ${licence}, ${NOM_ASSISTANT} fait tes ventes, suit ton stock et tes commandes à la voix : ${conv(offre.monthlyCredits)} par mois. Activation ${formatFCFA(offre.activationPrice)}, puis ${formatFCFA(offre.monthlyPrice)} par mois.`;
      bouton = `Activer ${NOM_ASSISTANT}`;
      message = `Bonjour, je veux activer ${NOM_ASSISTANT} pour ${o.boutique} (licence ${licence}).`;
      break;
    case "epuise":
      titre = "Plus de conversations ce mois-ci";
      texte = `Tu as utilisé tes ${conv(etat.total)} avec ${NOM_ASSISTANT}. Recharge ${conv(ASSISTANT_RECHARGE.credits)} pour ${formatFCFA(ASSISTANT_RECHARGE.price)}${etat.mois && etat.finLe && etat.finLe.getTime() > etat.mois.endsAt.getTime() ? `, ou attends le ${formatDate(etat.mois.endsAt)}` : ""}.`;
      bouton = "Demander une recharge";
      message = `Bonjour, je veux recharger ${NOM_ASSISTANT} pour ${o.boutique}.`;
      break;
    case "expire":
      titre = `Ton abonnement à ${NOM_ASSISTANT} est terminé`;
      texte = `${etat.finLe ? `Il est terminé depuis le ${formatDate(etat.finLe)}. ` : ""}Renouvelle-le pour ${formatFCFA(offre.monthlyPrice)} par mois (${conv(offre.monthlyCredits)}).`;
      bouton = "Renouveler";
      message = `Bonjour, je veux renouveler ${NOM_ASSISTANT} pour ${o.boutique} (licence ${licence}).`;
      break;
    case "essai_epuise":
      titre = `Tu as utilisé tes ${conv(ASSISTANT_TRIAL_CREDITS)} d'essai`;
      texte = `${NOM_ASSISTANT} vient avec la licence Sama Stock et son abonnement, à partir de ${formatFCFA(ASSISTANT_OFFERS.boutique.monthlyPrice)} par mois.`;
      bouton = "Contacter Sama Stock";
      message = `Bonjour, j'ai essayé ${NOM_ASSISTANT} et je veux la licence Sama Stock pour ${o.boutique}.`;
      break;
    default:
      titre = `${NOM_ASSISTANT} n'est pas disponible`;
      texte = `${NOM_ASSISTANT} n'est pas disponible pour ce commerce. Contacte Sama Stock.`;
      bouton = "Contacter Sama Stock";
      message = `Bonjour, j'ai une question sur ${NOM_ASSISTANT} pour ${o.boutique}.`;
  }
  return { statut: etat.statut, titre, texte, bouton: o.support ? bouton : null, lien: o.support ? waLink(o.support, message) : null };
}

/** Compteur affiché pendant la conversation. */
export interface CreditsAffiches {
  texte: string;
  /** Plus que 10 conversations ou moins : le compteur passe en orange. */
  alerte: boolean;
}

export function texteCredits(restants: number, essai: boolean): CreditsAffiches {
  const s = restants > 1 ? "s" : "";
  return { texte: `${restants} conversation${s}${essai ? " d'essai" : ""} restante${s}`, alerte: restants <= 10 };
}

export type GenrePaiement = "activation" | "mois" | "recharge";

/** Montant pré-rempli dans le formulaire de l'administrateur (prix catalogue). */
export function montantParDefaut(offre: LicensePackId, genre: GenrePaiement, nbMois = 1): number {
  if (genre === "recharge") return ASSISTANT_RECHARGE.price;
  const o = ASSISTANT_OFFERS[offre];
  return (genre === "activation" ? o.activationPrice : 0) + o.monthlyPrice * nbMois;
}

export function libellePaiement(p: { kind: GenrePaiement; months: number; credits: number }): string {
  if (p.kind === "activation") return `Activation + ${p.months} mois`;
  if (p.kind === "mois") return `${p.months} mois`;
  return `Recharge de ${conv(p.credits)}`;
}

/**
 * Le dernier paiement saisi s'annule tant que ses crédits n'ont pas servi : mois encore intacts, ou recharge dont les
 * crédits restent disponibles dans le mois qui la porte.
 */
export function peutAnnuler(p: { kind: GenrePaiement; credits: number }, moisCrees: readonly MoisAssistant[], moisRecharge: MoisAssistant | null): boolean {
  if (p.kind === "recharge") return moisRecharge !== null && totalDe(moisRecharge) - p.credits >= moisRecharge.used;
  return moisCrees.every((m) => m.used === 0);
}

export interface Rentabilite {
  encaisse: number;
  conversations: number;
  cout: number;
  marge: number;
}

export function rentabilite(encaisse: number, conversations: number, coutParConversation = ASSISTANT_COST_PER_CONVERSATION): Rentabilite {
  const cout = conversations * coutParConversation;
  return { encaisse, conversations, cout, marge: encaisse - cout };
}

export type RappelAssistant = "dix" | "zero" | "bientot" | "termine";

const JOUR = 86_400_000;

/** Rappel du jour (tâche de 9 h) : 3 jours avant la fin, ou le jour où elle est passée. */
export function rappelPour(finLe: Date, now = new Date()): "bientot" | "termine" | null {
  const ecart = finLe.getTime() - now.getTime();
  if (ecart > 2 * JOUR && ecart <= 3 * JOUR) return "bientot";
  if (ecart <= 0 && ecart > -JOUR) return "termine";
  return null;
}

/**
 * « Ma licence » vue par un gérant, qui y arrive en touchant une notification de Finch : ni prix ni paiements, seulement
 * où en est Finch et qui prévenir.
 */
export function avisGerant(etat: EtatAssistant): string {
  const credits =
    etat.mois && (etat.statut === "actif" || etat.statut === "epuise")
      ? `${texteCredits(etat.restants, false).texte}${etat.finLe ? ` jusqu'au ${formatDate(etat.finLe)}` : ""}. `
      : "";
  return `${credits}Seul le propriétaire de la boutique gère l'abonnement de ${NOM_ASSISTANT} : préviens-le.`;
}

/** Le lien mène à « Ma licence » : le propriétaire y paie, un gérant y lit qui prévenir (voir `avisGerant`). */
export function messageAssistant(rappel: RappelAssistant, finLe?: Date): NotifyMessage {
  const href = "/licence";
  switch (rappel) {
    case "dix":
      return { kind: "assistant", title: `Plus que 10 conversations avec ${NOM_ASSISTANT}`, body: "Il te reste 10 conversations ce mois-ci : pense à recharger avant d'en manquer.", href };
    case "zero":
      return { kind: "assistant", title: `Plus de conversations avec ${NOM_ASSISTANT}`, body: "Tu as utilisé toutes tes conversations de ce mois-ci. Demande une recharge à Sama Stock.", href };
    case "bientot":
      return {
        kind: "assistant",
        title: `Ton abonnement ${NOM_ASSISTANT} se termine bientôt`,
        body: `${finLe ? `Il se termine le ${formatDate(finLe)}.` : "Il se termine dans 3 jours."} Renouvelle-le pour garder ${NOM_ASSISTANT}.`,
        href,
      };
    case "termine":
      return { kind: "assistant", title: `Ton abonnement ${NOM_ASSISTANT} est terminé`, body: `Renouvelle-le pour retrouver ${NOM_ASSISTANT}.`, href };
  }
}

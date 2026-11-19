# Abonnement mensuel de Finch — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de l'assistant vocal Finch un abonnement mensuel payant (activation, mensualité, crédits par mois selon la licence), saisi par l'administrateur, à part de la licence à vie.

**Architecture:** Deux tables (`assistant_payments` pour l'argent, `assistant_months` pour les fenêtres de crédits). L'état d'un commerce, le placement des mois, les textes et les montants sont des fonctions pures (`src/lib/domain/assistant/abonnement.ts`). À l'ouverture de Finch, le serveur retire un crédit par une seule requête SQL atomique et le rend si Google échoue. L'administration saisit les paiements ; le commerçant voit une fiche WhatsApp quand Finch n'est pas payé.

**Tech Stack:** Next.js 16.4 (App Router, route handlers, server actions), Drizzle ORM 0.45 + drizzle-kit 0.31 (PostgreSQL Neon), Zod 4, Vitest 5, React 19, Tailwind, composants `src/components/ui` (shadcn).

**Spec:** `docs/superpowers/specs/2026-11-19-abonnement-assistant-design.md`

## Global Constraints

- Branche de travail : `assistant-abonnement` (jamais `master` avant la tâche 11).
- **Le `.env` local pointe sur la base de PRODUCTION.** Ne jamais lancer `npm run db:migrate`, `npm run dev` ni un script qui écrit en base avec le `DATABASE_URL` du `.env` pendant les tâches 1 à 10 ; la tâche 11 utilise une branche Neon.
- Langue : code, commentaires et textes en français, comme le reste du dépôt.
- Prix et crédits (catalogue) : Boutique 10 000 F / 5 000 F par mois / 100 conversations ; Pro 15 000 F / 10 000 F / 250 ; Business 20 000 F / 15 000 F / 500 ; recharge 50 conversations pour 3 000 F ; essai 10 conversations ; coût Google estimé 50 F par conversation ; 12 mois au plus par saisie.
- 1 crédit = 1 conversation. Crédits non utilisés perdus en fin de mois. Démonstrations gratuites (20 par jour). Limite de sécurité 60 par jour (`ASSISTANT_DAILY_LIMIT`).
- Numéro WhatsApp de Sama Stock : `LEGAL.whatsapp` (`src/lib/legal.ts`), avec `waLink(numero, texte)` (`src/lib/whatsapp.ts`).
- Moyens de paiement : `LICENSE_PAYMENT_METHODS` (`src/lib/domain/admin.ts`) : wave, orange_money, especes, virement, autre.
- Journal admin : `logAdmin(tx, ctx, { action: "assistant", businessId, summary })` (l'action `assistant` existe déjà).
- Vérifications après chaque tâche : `npx vitest run <fichiers de test touchés>` ; à la fin de chaque tâche qui touche du TypeScript : `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` (la machine a peu de mémoire) et `npx eslint <fichiers touchés>`.
- Commits : si `git config user.email` est vide, commiter avec `git -c user.name="Rassoul Tech" -c user.email="dionemhd1@gmail.com" commit …`. Chaque message finit par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Avant d'écrire du code Next.js qui sort des modèles déjà présents dans le dépôt, lire le guide concerné dans `node_modules/next/dist/docs/` (consigne d'`AGENTS.md`).

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/domain/plans.ts` (modifié) | Catalogue : `ASSISTANT_OFFERS`, `ASSISTANT_RECHARGE`, `ASSISTANT_TRIAL_CREDITS`, `ASSISTANT_COST_PER_CONVERSATION`, `ASSISTANT_RENEW_MAX_MONTHS` |
| `src/lib/domain/assistant/abonnement.ts` (créé) | Règles pures : état, placement des mois, fiche, textes, montants, annulation, rentabilité, rappels |
| `src/lib/domain/assistant/abonnement.test.ts` (créé) | Tests des règles |
| `src/lib/domain/notifications.ts` (+ test) | Type et sujet de notification `assistant` |
| `src/db/schema/app.ts` (modifié) + `drizzle/0015_assistant_abonnement.sql` (généré) | Tables `assistant_payments`, `assistant_months` |
| `src/server/backup/tables.ts`, `src/server/backup/restore.ts` | Les deux tables dans la sauvegarde admin |
| `src/server/queries/assistant.ts` (créé) | Lectures : mois, paiements, à renouveler, rentabilité, fins d'abonnement |
| `src/server/assistant/abonnement.ts` (créé) | Retrait et remise d'un crédit, alertes 10 / 0 |
| `src/server/assistant/contexte.ts`, `src/app/api/assistant/session/route.ts` | Ouverture de Finch avec crédits |
| `src/components/assistant/api.ts`, `direct/conversation.ts`, `assistant-provider.tsx`, `pilote/plein-ecran.tsx` | Fiche et compteur côté téléphone |
| `src/components/assistant/fiche-assistant.tsx` (créé) | Fenêtre « Activer / Renouveler / Recharger Finch » |
| `src/app/(app)/layout.tsx` | Bouton micro selon le statut, fiche montée |
| `src/server/services/notifications.ts` | `notifySysteme` (notification sans auteur) |
| `src/app/api/assistant/rappels/route.ts` (créé), `vercel.json` | Rappels quotidiens à 9 h |
| `src/server/actions/assistant-abonnement.ts` (créé) | Actions admin : activer, renouveler, recharger, annuler |
| `src/components/admin/assistant/assistant-card.tsx`, `assistant-forms.tsx` (créés) | Section « Assistant Finch » de la fiche commerce |
| `src/app/admin/commerces/[id]/page.tsx`, `src/components/admin/admin-actions.tsx`, `src/server/actions/admin.ts`, `src/server/queries/admin.ts` | Branchement de la section, retrait de l'interrupteur |
| `src/app/admin/page.tsx` | « Assistant : à renouveler » et « Rentabilité de l'assistant » |
| `src/components/billing/assistant-card.tsx` (créé), `src/app/(app)/licence/page.tsx` | Carte du commerçant |
| `src/server/demo/index.ts`, `src/server/demo/seed.ts`, `LISEZ-MOI.md` | Démo sans la colonne, documentation |

---

### Task 1: Catalogue, état et placement des mois

**Files:**
- Modify: `src/lib/domain/plans.ts` (après `DEMO_LICENCE`, fin du fichier)
- Create: `src/lib/domain/assistant/abonnement.ts`
- Test: `src/lib/domain/assistant/abonnement.test.ts`

**Interfaces:**
- Produces (plans.ts) : `interface AssistantOffer { activationPrice: number; monthlyPrice: number; monthlyCredits: number }`, `ASSISTANT_OFFERS: Record<LicensePackId, AssistantOffer>`, `ASSISTANT_RECHARGE: { credits: 50; price: 3000 }`, `ASSISTANT_TRIAL_CREDITS = 10`, `ASSISTANT_COST_PER_CONVERSATION = 50`, `ASSISTANT_RENEW_MAX_MONTHS = 12`.
- Produces (abonnement.ts) : `type GenreMois = "abonnement" | "essai"`, `interface MoisAssistant { id; kind: GenreMois; startsAt: Date; endsAt: Date; credits; extraCredits; used }`, `type StatutAssistant`, `interface EtatAssistant { statut; offre: LicensePackId | null; mois: MoisAssistant | null; restants; total; finLe: Date | null }`, `boutonAssistantVisible(plan, isDemo): boolean`, `finAbonnement(mois): Date | null`, `moisPlus(date, k): Date`, `planifierMois(mois, n, now?): { startsAt: Date; endsAt: Date }[]`, `etatAssistant({ isDemo, plan, mois }, now?): EtatAssistant`, `STATUTS_ASSISTANT: Record<StatutAssistant, string>`.

- [ ] **Step 1: Écrire les tests (ils échouent)**

Créer `src/lib/domain/assistant/abonnement.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { ASSISTANT_OFFERS, ASSISTANT_RECHARGE, ASSISTANT_TRIAL_CREDITS } from "../plans";
import { boutonAssistantVisible, etatAssistant, finAbonnement, moisPlus, planifierMois, type MoisAssistant } from "./abonnement";

const d = (s: string) => new Date(s);
const now = d("2026-11-19T10:00:00Z");
const mois = (p: Partial<MoisAssistant> & Pick<MoisAssistant, "startsAt" | "endsAt">): MoisAssistant => ({
  id: "m1",
  kind: "abonnement",
  credits: 250,
  extraCredits: 0,
  used: 0,
  ...p,
});
const sousLicence = { status: "active" as const, license: "pro" as const };
const enEssai = { status: "trialing" as const, license: null };
const enCours = mois({ startsAt: d("2026-11-05T08:00:00Z"), endsAt: d("2026-12-05T08:00:00Z"), used: 63 });

describe("catalogue de l'assistant", () => {
  it("donne une offre par licence", () => {
    expect(ASSISTANT_OFFERS.boutique).toEqual({ activationPrice: 10_000, monthlyPrice: 5_000, monthlyCredits: 100 });
    expect(ASSISTANT_OFFERS.pro).toEqual({ activationPrice: 15_000, monthlyPrice: 10_000, monthlyCredits: 250 });
    expect(ASSISTANT_OFFERS.business).toEqual({ activationPrice: 20_000, monthlyPrice: 15_000, monthlyCredits: 500 });
    expect(ASSISTANT_RECHARGE).toEqual({ credits: 50, price: 3_000 });
    expect(ASSISTANT_TRIAL_CREDITS).toBe(10);
  });
});

describe("moisPlus", () => {
  it("garde le jour du mois", () => {
    expect(moisPlus(d("2026-11-19T10:00:00Z"), 1)).toEqual(d("2026-12-19T10:00:00Z"));
  });
  it("ramène au dernier jour d'un mois plus court", () => {
    expect(moisPlus(d("2027-01-31T10:00:00Z"), 1)).toEqual(d("2027-02-28T10:00:00Z"));
    expect(moisPlus(d("2027-01-31T10:00:00Z"), 2)).toEqual(d("2027-03-31T10:00:00Z"));
  });
});

describe("planifierMois", () => {
  it("part d'aujourd'hui quand rien n'est en cours", () => {
    expect(planifierMois([], 2, now)).toEqual([
      { startsAt: now, endsAt: d("2026-12-19T10:00:00Z") },
      { startsAt: d("2026-12-19T10:00:00Z"), endsAt: d("2027-01-19T10:00:00Z") },
    ]);
  });
  it("ajoute les mois payés d'avance après la fin actuelle", () => {
    expect(planifierMois([enCours], 1, now)).toEqual([{ startsAt: d("2026-12-05T08:00:00Z"), endsAt: d("2027-01-05T08:00:00Z") }]);
  });
  it("repart d'aujourd'hui après une expiration et ignore l'essai", () => {
    const fini = mois({ startsAt: d("2026-09-01T08:00:00Z"), endsAt: d("2026-10-01T08:00:00Z") });
    const essai = mois({ kind: "essai", credits: 10, startsAt: d("2026-11-10T08:00:00Z"), endsAt: d("2026-11-24T08:00:00Z") });
    expect(planifierMois([fini, essai], 1, now)[0].startsAt).toEqual(now);
  });
  it("ne dérive pas en fin de mois", () => {
    expect(planifierMois([], 3, d("2027-01-31T10:00:00Z")).map((m) => m.endsAt)).toEqual([
      d("2027-02-28T10:00:00Z"),
      d("2027-03-31T10:00:00Z"),
      d("2027-04-30T10:00:00Z"),
    ]);
  });
});

describe("finAbonnement", () => {
  it("rend la fin du dernier mois d'abonnement, sans l'essai", () => {
    const avance = mois({ id: "m2", startsAt: d("2026-12-05T08:00:00Z"), endsAt: d("2027-01-05T08:00:00Z") });
    const essai = mois({ kind: "essai", credits: 10, startsAt: d("2026-11-10T08:00:00Z"), endsAt: d("2027-06-01T08:00:00Z") });
    expect(finAbonnement([enCours, avance, essai])).toEqual(d("2027-01-05T08:00:00Z"));
    expect(finAbonnement([essai])).toBeNull();
  });
});

describe("boutonAssistantVisible", () => {
  it("montre le micro aux démos, aux licences et pendant l'essai", () => {
    expect(boutonAssistantVisible(sousLicence, false)).toBe(true);
    expect(boutonAssistantVisible(enEssai, false)).toBe(true);
    expect(boutonAssistantVisible({ status: "active", license: "boutique" }, true)).toBe(true);
  });
  it("le cache pour un commerce suspendu ou un essai fini", () => {
    expect(boutonAssistantVisible({ status: "suspended", license: "pro" }, false)).toBe(false);
    expect(boutonAssistantVisible({ status: "expired", license: null }, false)).toBe(false);
  });
});

describe("etatAssistant", () => {
  it("démonstration", () => {
    expect(etatAssistant({ isDemo: true, plan: { status: "active", license: "business" }, mois: [] }, now).statut).toBe("demo");
  });
  it("sous licence, jamais activé : inactif", () => {
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [] }, now)).toEqual({
      statut: "inactif",
      offre: "pro",
      mois: null,
      restants: 0,
      total: 0,
      finLe: null,
    });
  });
  it("mois en cours avec crédits et recharge : actif", () => {
    const recharge = { ...enCours, extraCredits: 50 };
    const e = etatAssistant({ isDemo: false, plan: sousLicence, mois: [recharge] }, now);
    expect(e).toMatchObject({ statut: "actif", restants: 237, total: 300, finLe: d("2026-12-05T08:00:00Z") });
    expect(e.mois?.id).toBe("m1");
  });
  it("mois payé d'avance : la fin est celle du dernier", () => {
    const avance = mois({ id: "m2", startsAt: d("2026-12-05T08:00:00Z"), endsAt: d("2027-01-05T08:00:00Z") });
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [enCours, avance] }, now).finLe).toEqual(d("2027-01-05T08:00:00Z"));
  });
  it("tous les crédits utilisés : épuisé", () => {
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [{ ...enCours, used: 250 }] }, now)).toMatchObject({ statut: "epuise", restants: 0 });
  });
  it("plus aucun mois en cours : expiré", () => {
    const fini = mois({ startsAt: d("2026-09-01T08:00:00Z"), endsAt: d("2026-10-01T08:00:00Z") });
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [fini] }, now)).toMatchObject({ statut: "expire", finLe: d("2026-10-01T08:00:00Z") });
  });
  it("essai sans fenêtre : 10 conversations offertes", () => {
    expect(etatAssistant({ isDemo: false, plan: enEssai, mois: [] }, now)).toMatchObject({ statut: "essai", restants: 10, total: 10, offre: null });
  });
  it("essai avec fenêtre entamée, puis épuisé", () => {
    const essai = mois({ kind: "essai", credits: 10, used: 4, startsAt: d("2026-11-10T08:00:00Z"), endsAt: d("2026-11-24T08:00:00Z") });
    expect(etatAssistant({ isDemo: false, plan: enEssai, mois: [essai] }, now)).toMatchObject({ statut: "essai", restants: 6 });
    expect(etatAssistant({ isDemo: false, plan: enEssai, mois: [{ ...essai, used: 10 }] }, now)).toMatchObject({ statut: "essai_epuise", restants: 0 });
  });
  it("sous licence, la fenêtre d'essai ne compte plus", () => {
    const essai = mois({ kind: "essai", credits: 10, used: 2, startsAt: d("2026-11-10T08:00:00Z"), endsAt: d("2026-11-24T08:00:00Z") });
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [essai] }, now).statut).toBe("inactif");
  });
  it("commerce suspendu ou essai fini : indisponible", () => {
    expect(etatAssistant({ isDemo: false, plan: { status: "suspended", license: "pro" }, mois: [enCours] }, now).statut).toBe("indisponible");
    expect(etatAssistant({ isDemo: false, plan: { status: "expired", license: null }, mois: [] }, now).statut).toBe("indisponible");
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/domain/assistant/abonnement.test.ts`
Expected: FAIL (module `./abonnement` introuvable, `ASSISTANT_OFFERS` non exporté).

- [ ] **Step 3: Ajouter le catalogue à la fin de `src/lib/domain/plans.ts`**

```ts
/**
 * Assistant vocal Finch : abonnement mensuel, à part de la licence à vie. L'offre suit la licence du commerce ;
 * 1 crédit = 1 conversation ; les crédits non utilisés sont perdus à la fin du mois.
 */
export interface AssistantOffer {
  /** Payé une fois, à la première mise en service. */
  activationPrice: number;
  monthlyPrice: number;
  monthlyCredits: number;
}

export const ASSISTANT_OFFERS: Record<LicensePackId, AssistantOffer> = {
  boutique: { activationPrice: 10_000, monthlyPrice: 5_000, monthlyCredits: 100 },
  pro: { activationPrice: 15_000, monthlyPrice: 10_000, monthlyCredits: 250 },
  business: { activationPrice: 20_000, monthlyPrice: 15_000, monthlyCredits: 500 },
};

/** Conversations en plus, valables jusqu'à la fin du mois en cours. */
export const ASSISTANT_RECHARGE = { credits: 50, price: 3_000 } as const;

/** Conversations offertes pendant l'essai gratuit (commerce sans licence). */
export const ASSISTANT_TRIAL_CREDITS = 10;

/** Coût Google estimé d'une conversation (FCFA), pour la carte de rentabilité : à ajuster avec la vraie facture. */
export const ASSISTANT_COST_PER_CONVERSATION = 50;

/** Mois payés au plus en une seule saisie. */
export const ASSISTANT_RENEW_MAX_MONTHS = 12;
```

- [ ] **Step 4: Créer `src/lib/domain/assistant/abonnement.ts`**

```ts
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
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/domain/assistant/abonnement.test.ts`
Expected: PASS (tous les tests de `abonnement.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/domain/plans.ts src/lib/domain/assistant/abonnement.ts src/lib/domain/assistant/abonnement.test.ts
git commit -m "feat(assistant): catalogue de l'abonnement Finch, état d'un commerce et placement des mois

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Textes, montants, annulation, rentabilité, rappels et type de notification

**Files:**
- Modify: `src/lib/domain/assistant/abonnement.ts` (ajouts en fin de fichier)
- Modify: `src/lib/domain/notifications.ts:6-51` (type `assistant`)
- Modify: `src/server/actions/notifications.ts:33` (`prefsSchema`)
- Test: `src/lib/domain/assistant/abonnement.test.ts`, `src/lib/domain/notifications.test.ts:24-25`

**Interfaces:**
- Consumes: Task 1 (`EtatAssistant`, `MoisAssistant`, `StatutAssistant`, catalogue).
- Produces: `interface FicheAssistant { statut: StatutAssistant; titre: string; texte: string; bouton: string | null; lien: string | null }`, `ficheAssistant(etat, { boutique, peutPayer, support }): FicheAssistant | null`, `interface CreditsAffiches { texte: string; alerte: boolean }`, `texteCredits(restants, essai): CreditsAffiches`, `type GenrePaiement = "activation" | "mois" | "recharge"`, `montantParDefaut(offre, genre, nbMois?): number`, `libellePaiement({ kind, months, credits }): string`, `peutAnnuler({ kind, credits }, moisCrees, moisRecharge): boolean`, `interface Rentabilite { encaisse; conversations; cout; marge }`, `rentabilite(encaisse, conversations, coutParConversation?): Rentabilite`, `type RappelAssistant = "dix" | "zero" | "bientot" | "termine"`, `rappelPour(finLe, now?): "bientot" | "termine" | null`, `messageAssistant(rappel, finLe?): NotifyMessage`. Dans `notifications.ts` : `NotifyKind` inclut `"assistant"`, `NotifyTopic` inclut `"assistant"`.

- [ ] **Step 1: Ajouter les tests (ils échouent)**

Ajouter à la fin de `src/lib/domain/assistant/abonnement.test.ts` (compléter l'import du haut avec `ficheAssistant, libellePaiement, messageAssistant, montantParDefaut, peutAnnuler, rappelPour, rentabilite, texteCredits`, et ajouter `import { formatFCFA } from "@/lib/format";` — les montants s'écrivent avec une espace insécable, on les compare donc avec la fonction elle-même) :

```ts
describe("ficheAssistant", () => {
  const o = { boutique: "Awa Mode", peutPayer: true, support: "221773831364" };
  it("rien à montrer quand Finch peut parler", () => {
    expect(ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [enCours] }, now), o)).toBeNull();
    expect(ficheAssistant(etatAssistant({ isDemo: false, plan: enEssai, mois: [] }, now), o)).toBeNull();
  });
  it("inactif : l'offre de la licence et un lien WhatsApp pré-rempli", () => {
    const f = ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [] }, now), o);
    expect(f?.titre).toBe("Finch, ton employé qui parle wolof");
    expect(f?.texte).toContain("250 conversations par mois");
    expect(f?.texte).toContain(formatFCFA(15_000));
    expect(f?.bouton).toBe("Activer Finch");
    expect(f?.lien).toBe(`https://wa.me/221773831364?text=${encodeURIComponent("Bonjour, je veux activer Finch pour Awa Mode (licence Pro).")}`);
  });
  it("épuisé : la recharge et la fin du mois", () => {
    const f = ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [{ ...enCours, used: 250 }] }, now), o);
    expect(f?.texte).toContain("250 conversations");
    expect(f?.texte).toContain("50 conversations");
    expect(f?.bouton).toBe("Demander une recharge");
  });
  it("employé : pas de prix ni de lien", () => {
    const f = ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [] }, now), { ...o, peutPayer: false });
    expect(f).toMatchObject({ bouton: null, lien: null });
    expect(f?.texte).toContain("préviens le propriétaire");
  });
  it("sans numéro d'assistance : pas de bouton", () => {
    expect(ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [] }, now), { ...o, support: null })).toMatchObject({ bouton: null, lien: null });
  });
});

describe("texteCredits", () => {
  it("compte et alerte à partir de 10", () => {
    expect(texteCredits(187, false)).toEqual({ texte: "187 conversations restantes", alerte: false });
    expect(texteCredits(10, false).alerte).toBe(true);
    expect(texteCredits(1, true)).toEqual({ texte: "1 conversation d'essai restante", alerte: true });
  });
});

describe("montants et libellés", () => {
  it("pré-remplit les montants du catalogue", () => {
    expect(montantParDefaut("pro", "activation", 1)).toBe(25_000);
    expect(montantParDefaut("pro", "mois", 3)).toBe(30_000);
    expect(montantParDefaut("boutique", "recharge")).toBe(3_000);
  });
  it("décrit chaque paiement", () => {
    expect(libellePaiement({ kind: "activation", months: 1, credits: 0 })).toBe("Activation + 1 mois");
    expect(libellePaiement({ kind: "mois", months: 3, credits: 0 })).toBe("3 mois");
    expect(libellePaiement({ kind: "recharge", months: 0, credits: 50 })).toBe("Recharge de 50 conversations");
  });
});

describe("peutAnnuler", () => {
  it("des mois encore intacts", () => {
    expect(peutAnnuler({ kind: "mois", credits: 0 }, [{ ...enCours, used: 0 }], null)).toBe(true);
    expect(peutAnnuler({ kind: "activation", credits: 0 }, [enCours], null)).toBe(false);
  });
  it("une recharge dont les crédits restent disponibles", () => {
    expect(peutAnnuler({ kind: "recharge", credits: 50 }, [], { ...enCours, extraCredits: 50, used: 250 })).toBe(true);
    expect(peutAnnuler({ kind: "recharge", credits: 50 }, [], { ...enCours, extraCredits: 50, used: 251 })).toBe(false);
    expect(peutAnnuler({ kind: "recharge", credits: 50 }, [], null)).toBe(false);
  });
});

describe("rentabilite", () => {
  it("compare l'argent encaissé au coût Google estimé", () => {
    expect(rentabilite(60_000, 400)).toEqual({ encaisse: 60_000, conversations: 400, cout: 20_000, marge: 40_000 });
    expect(rentabilite(0, 10, 100).marge).toBe(-1_000);
  });
});

describe("rappels", () => {
  const fin = d("2026-11-22T10:00:00Z");
  it("prévient 3 jours avant, puis le jour de la fin", () => {
    expect(rappelPour(fin, d("2026-11-19T11:00:00Z"))).toBe("bientot");
    expect(rappelPour(fin, d("2026-11-20T11:00:00Z"))).toBeNull();
    expect(rappelPour(fin, d("2026-11-22T11:00:00Z"))).toBe("termine");
    expect(rappelPour(fin, d("2026-11-23T11:00:00Z"))).toBeNull();
  });
  it("écrit des messages qui mènent à la page Licence", () => {
    expect(messageAssistant("dix")).toMatchObject({ kind: "assistant", href: "/licence" });
    expect(messageAssistant("bientot", fin).body).toContain("22");
  });
});
```

Dans `src/lib/domain/notifications.test.ts`, remplacer les lignes 24-25 :

```ts
    expect(notifyPrefs(null)).toEqual({ sale: true, order: true, stock: true, assistant: true, sound: true });
    expect(notifyPrefs({ sale: false, sound: false })).toEqual({ sale: false, order: true, stock: true, assistant: true, sound: false });
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/domain/assistant/abonnement.test.ts src/lib/domain/notifications.test.ts`
Expected: FAIL (fonctions non exportées, `assistant` absent des réglages).

- [ ] **Step 3: Ajouter le type de notification `assistant` dans `src/lib/domain/notifications.ts`**

Remplacer :

```ts
export const NOTIFY_KINDS = ["sale", "sale_cancel", "order", "stock_low", "stock_out"] as const;
```

par :

```ts
export const NOTIFY_KINDS = ["sale", "sale_cancel", "order", "stock_low", "stock_out", "assistant"] as const;
```

Remplacer le bloc du sujet et des libellés :

```ts
export type NotifyTopic = "sale" | "order" | "stock";
export const TOPIC_OF: Record<NotifyKind, NotifyTopic> = {
  sale: "sale",
  sale_cancel: "sale",
  order: "order",
  stock_low: "stock",
  stock_out: "stock",
};

export const TOPICS: Record<NotifyTopic, { label: string; hint: string }> = {
  sale: { label: "Ventes", hint: "Chaque vente faite, annulée ou corrigée par votre équipe" },
  order: { label: "Commandes", hint: "Chaque nouvelle commande client" },
  stock: { label: "Stock bas et ruptures", hint: "Quand un produit passe sous son seuil d'alerte ou n'en a plus" },
};
```

par :

```ts
export type NotifyTopic = "sale" | "order" | "stock" | "assistant";
export const TOPIC_OF: Record<NotifyKind, NotifyTopic> = {
  sale: "sale",
  sale_cancel: "sale",
  order: "order",
  stock_low: "stock",
  stock_out: "stock",
  assistant: "assistant",
};

export const TOPICS: Record<NotifyTopic, { label: string; hint: string }> = {
  sale: { label: "Ventes", hint: "Chaque vente faite, annulée ou corrigée par votre équipe" },
  order: { label: "Commandes", hint: "Chaque nouvelle commande client" },
  stock: { label: "Stock bas et ruptures", hint: "Quand un produit passe sous son seuil d'alerte ou n'en a plus" },
  assistant: { label: "Assistant Finch", hint: "Fin de l'abonnement et crédits presque épuisés" },
};
```

Dans `notifyPrefs`, remplacer :

```ts
  return { sale: on("sale"), order: on("order"), stock: on("stock"), sound: on("sound") };
```

par :

```ts
  return { sale: on("sale"), order: on("order"), stock: on("stock"), assistant: on("assistant"), sound: on("sound") };
```

Remplacer `notifiesActor` :

```ts
export function notifiesActor(kind: NotifyKind): boolean {
  return TOPIC_OF[kind] === "stock";
}
```

par :

```ts
export function notifiesActor(kind: NotifyKind): boolean {
  // Stock et abonnement concernent tout le monde, y compris la personne qui a fait l'action
  return TOPIC_OF[kind] === "stock" || TOPIC_OF[kind] === "assistant";
}
```

Dans `src/server/actions/notifications.ts`, remplacer :

```ts
const prefsSchema = z.object({ sale: z.boolean(), order: z.boolean(), stock: z.boolean(), sound: z.boolean() });
```

par :

```ts
const prefsSchema = z.object({ sale: z.boolean(), order: z.boolean(), stock: z.boolean(), assistant: z.boolean().default(true), sound: z.boolean() });
```

- [ ] **Step 4: Ajouter les fonctions à la fin de `src/lib/domain/assistant/abonnement.ts`**

Compléter l'import du haut du fichier :

```ts
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
```

(et retirer l'ancien `import { ASSISTANT_TRIAL_CREDITS, type LicensePackId, type PlanState } from "../plans";`). Puis ajouter :

```ts
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
      texte = `Tu as utilisé tes ${conv(etat.total)} avec ${NOM_ASSISTANT}. Recharge ${conv(ASSISTANT_RECHARGE.credits)} pour ${formatFCFA(ASSISTANT_RECHARGE.price)}${etat.mois ? `, ou attends le ${formatDate(etat.mois.endsAt)}` : ""}.`;
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
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/domain/assistant/abonnement.test.ts src/lib/domain/notifications.test.ts`
Expected: PASS. Si le test « écrit des messages » échoue sur `"22"`, vérifier le format de `formatDate` (`src/lib/format.ts`) et adapter l'attente au jour affiché, sans changer la fonction.

- [ ] **Step 6: Vérifier les types et le lint, puis commit**

Run: `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` puis `npx eslint src/lib/domain/assistant src/lib/domain/notifications.ts src/server/actions/notifications.ts`
Expected: aucune erreur (`notification-settings.tsx` affiche le nouveau sujet tout seul : il parcourt `TOPICS`).

```bash
git add src/lib/domain/assistant src/lib/domain/notifications.ts src/lib/domain/notifications.test.ts src/server/actions/notifications.ts
git commit -m "feat(assistant): fiche, compteur, montants, annulation, rentabilité et rappels de l'abonnement Finch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tables, migration et sauvegardes

**Files:**
- Modify: `src/db/schema/app.ts` (import `check` ; tables après `assistantUsage`)
- Create (généré) : `drizzle/0015_assistant_abonnement.sql`, `drizzle/meta/*`
- Modify: `src/server/backup/tables.ts:5-25`, `src/server/backup/restore.ts:120-130`

**Interfaces:**
- Produces: `assistantPayments` (colonnes `id, businessId, kind, months, credits, amount, method, note, recordedBy, paidAt, createdAt`), `assistantMonths` (colonnes `id, businessId, kind, startsAt, endsAt, credits, extraCredits, used, paymentId, createdAt`), exportées par `@/db/schema`.

- [ ] **Step 1: Ajouter `check` à l'import de `drizzle-orm/pg-core` dans `src/db/schema/app.ts`**

```ts
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Ajouter les deux tables à la fin de `src/db/schema/app.ts`**

```ts
/** Argent reçu pour l'assistant Finch : activation (avec ses premiers mois), mois, recharge. */
export const assistantPayments = pgTable(
  "assistant_payments",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // activation | mois | recharge
    /** Mois payés (activation, mois) ; 0 pour une recharge. */
    months: integer("months").notNull().default(0),
    /** Conversations ajoutées par une recharge ; 0 sinon. */
    credits: integer("credits").notNull().default(0),
    /** Montant réellement reçu, en FCFA. */
    amount: integer("amount").notNull(),
    method: text("method").notNull(), // wave | orange_money | especes | virement | autre
    note: text("note"),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("assistant_payments_business_idx").on(t.businessId)],
);

/** Fenêtres de crédits de Finch : un mois d'abonnement payé, ou l'essai gratuit (1 crédit = 1 conversation). */
export const assistantMonths = pgTable(
  "assistant_months",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // abonnement | essai
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    credits: integer("credits").notNull(),
    extraCredits: integer("extra_credits").notNull().default(0),
    used: integer("used").notNull().default(0),
    paymentId: text("payment_id").references(() => assistantPayments.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("assistant_months_business_idx").on(t.businessId, t.startsAt),
    // Une seule fenêtre d'essai par commerce
    uniqueIndex("assistant_months_essai_idx").on(t.businessId).where(sql`${t.kind} = 'essai'`),
    check("assistant_months_used_check", sql`${t.used} >= 0 and ${t.used} <= ${t.credits} + ${t.extraCredits}`),
  ],
);
```

- [ ] **Step 3: Générer la migration (sans toucher la base)**

Run: `npx drizzle-kit generate --name assistant_abonnement`
Expected: un fichier `drizzle/0015_assistant_abonnement.sql` qui crée les deux tables, les clés étrangères, les index (dont `assistant_months_essai_idx` avec `WHERE "assistant_months"."kind" = 'essai'`) et la contrainte `assistant_months_used_check`. Ouvrir le fichier et vérifier qu'il ne touche **aucune autre table** (pas de `ALTER TABLE "businesses"`).

- [ ] **Step 4: Ajouter les tables à la sauvegarde admin**

Dans `src/server/backup/tables.ts`, compléter l'import :

```ts
import {
  adminAuditLog, assistantMonths, assistantPayments, businessNotes, categories, customerPayments, customers, documentItems, documents,
  invitations, licensePayments, licenseSales, locations, members, products, purchaseItems, purchases, saleItems, sales, shopDevices,
  stockLevels, stockMovements, suppliers, user,
} from "@/db/schema";
```

et remplacer :

```ts
export const ADMIN_TABLES = { licenseSales, licensePayments, businessNotes, adminAuditLog } as const;
```

par :

```ts
export const ADMIN_TABLES = { licenseSales, licensePayments, businessNotes, adminAuditLog, assistantPayments, assistantMonths } as const;
```

Dans `src/server/backup/restore.ts` (`restoreAdminPayload`), remplacer :

```ts
    const { licensePayments, licenseSales, businessNotes, adminAuditLog } = ADMIN_TABLES;
    await tx.delete(licensePayments);
    await tx.delete(licenseSales);
    await tx.delete(businessNotes);
    await tx.delete(adminAuditLog);
    const ofKnownShop = (rows: Row[]) => rows.filter((r) => shops.has(r.businessId as string));
    await insertRows(tx, licenseSales, ofKnownShop((payload.tables.licenseSales ?? []) as Row[]), knownUsers);
    await insertRows(tx, licensePayments, ofKnownShop((payload.tables.licensePayments ?? []) as Row[]), knownUsers);
```

par :

```ts
    const { licensePayments, licenseSales, businessNotes, adminAuditLog, assistantPayments, assistantMonths } = ADMIN_TABLES;
    await tx.delete(assistantMonths);
    await tx.delete(assistantPayments);
    await tx.delete(licensePayments);
    await tx.delete(licenseSales);
    await tx.delete(businessNotes);
    await tx.delete(adminAuditLog);
    const ofKnownShop = (rows: Row[]) => rows.filter((r) => shops.has(r.businessId as string));
    await insertRows(tx, licenseSales, ofKnownShop((payload.tables.licenseSales ?? []) as Row[]), knownUsers);
    await insertRows(tx, licensePayments, ofKnownShop((payload.tables.licensePayments ?? []) as Row[]), knownUsers);
    // Fichiers d'avant l'abonnement de Finch : ces tables y sont absentes (listes vides)
    await insertRows(tx, assistantPayments, ofKnownShop((payload.tables.assistantPayments ?? []) as Row[]), knownUsers);
    await insertRows(tx, assistantMonths, ofKnownShop((payload.tables.assistantMonths ?? []) as Row[]), knownUsers);
```

et, dans la phrase du commentaire de la fonction, remplacer `/** Remet licences, paiements, notes et journal dans l'état du fichier admin. */` par `/** Remet licences, paiements, abonnements de Finch, notes et journal dans l'état du fichier admin. */`.

- [ ] **Step 5: Vérifier types, lint et tests existants**

Run: `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` puis `npx eslint src/db/schema src/server/backup` puis `npx vitest run src/server/backup`
Expected: aucune erreur ; les tests de sauvegarde passent (s'il y en a).

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/app.ts drizzle src/server/backup/tables.ts src/server/backup/restore.ts
git commit -m "feat(assistant): tables des paiements et des mois de Finch (migration 0015), dans la sauvegarde admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ouverture de Finch avec crédits (serveur)

**Files:**
- Create: `src/server/queries/assistant.ts` (lecture des mois ; complété aux tâches 6, 7, 8)
- Create: `src/server/assistant/abonnement.ts`
- Modify: `src/server/assistant/contexte.ts:1-27`
- Modify: `src/app/api/assistant/session/route.ts` (fichier entier)

**Interfaces:**
- Consumes: Task 1-3 (`etatAssistant`, `boutonAssistantVisible`, `ficheAssistant`, `messageAssistant`, `ASSISTANT_TRIAL_CREDITS`, `assistantMonths`).
- Produces: `type MoisEnBase = MoisAssistant & { paymentId: string | null }`, `moisDuCommerce(businessId): Promise<MoisEnBase[]>` (queries) ; `type Ouverture = { ok: true; moisId: string | null; restants: number | null; genre: GenreMois | null } | { ok: false; etat: EtatAssistant }`, `ouvrirConversation(ctx): Promise<Ouverture>`, `rendreCredit(moisId): Promise<void>`, `prevenirSiPeuDeCredits(ctx, ouverture): Promise<void>` ; réponse JSON de `POST /api/assistant/session` : succès `{ jeton, modele, expireLe, credits: { restants: number; essai: boolean } | null }`, refus 402 `{ error: string, fiche: FicheAssistant | null }`.

- [ ] **Step 1: Créer `src/server/queries/assistant.ts`**

```ts
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistantMonths } from "@/db/schema";
import type { MoisAssistant } from "@/lib/domain/assistant/abonnement";

export type MoisEnBase = MoisAssistant & { paymentId: string | null };

/** Fenêtres de crédits d'un commerce, de la plus ancienne à la plus récente. */
export async function moisDuCommerce(businessId: string): Promise<MoisEnBase[]> {
  const rows = await db
    .select({
      id: assistantMonths.id,
      kind: assistantMonths.kind,
      startsAt: assistantMonths.startsAt,
      endsAt: assistantMonths.endsAt,
      credits: assistantMonths.credits,
      extraCredits: assistantMonths.extraCredits,
      used: assistantMonths.used,
      paymentId: assistantMonths.paymentId,
    })
    .from(assistantMonths)
    .where(eq(assistantMonths.businessId, businessId))
    .orderBy(asc(assistantMonths.startsAt));
  return rows.map((r) => ({ ...r, kind: r.kind === "essai" ? "essai" : "abonnement" }));
}
```

- [ ] **Step 2: Créer `src/server/assistant/abonnement.ts`**

```ts
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantMonths } from "@/db/schema";
import { etatAssistant, messageAssistant, type EtatAssistant, type GenreMois } from "@/lib/domain/assistant/abonnement";
import { ASSISTANT_TRIAL_CREDITS } from "@/lib/domain/plans";
import type { BusinessContext } from "../context";
import { moisDuCommerce } from "../queries/assistant";
import { notify } from "../services/notifications";

export async function etatDuCommerce(ctx: BusinessContext): Promise<EtatAssistant> {
  return etatAssistant({ isDemo: ctx.business.isDemo, plan: ctx.plan, mois: await moisDuCommerce(ctx.business.id) });
}

export type Ouverture =
  | { ok: true; moisId: string | null; restants: number | null; genre: GenreMois | null }
  | { ok: false; etat: EtatAssistant };

/**
 * Retire un crédit pour une conversation. Une seule requête : deux téléphones sur le dernier crédit, un seul passe.
 * Démonstration : rien à retirer. Essai : la fenêtre de 10 conversations se crée à la première fois.
 */
export async function ouvrirConversation(ctx: BusinessContext): Promise<Ouverture> {
  if (ctx.business.isDemo) return { ok: true, moisId: null, restants: null, genre: null };
  const genre: GenreMois = ctx.plan.license ? "abonnement" : "essai";
  if (genre === "essai" && ctx.plan.status === "trialing" && ctx.plan.endsAt) {
    await db
      .insert(assistantMonths)
      .values({ businessId: ctx.business.id, kind: "essai", startsAt: new Date(), endsAt: ctx.plan.endsAt, credits: ASSISTANT_TRIAL_CREDITS })
      .onConflictDoNothing();
  }
  const res = await db.execute<{ id: string; restants: number }>(sql`
    update assistant_months set used = used + 1
    where id = (
      select id from assistant_months
      where business_id = ${ctx.business.id} and kind = ${genre}
        and starts_at <= now() and ends_at > now() and used < credits + extra_credits
      order by ends_at asc
      limit 1
    ) and used < credits + extra_credits
    returning id, credits + extra_credits - used as restants`);
  const row = res.rows[0];
  if (row) return { ok: true, moisId: row.id, restants: Number(row.restants), genre };
  return { ok: false, etat: await etatDuCommerce(ctx) };
}

/** Conversation qui n'a pas eu lieu (Google en panne, limite du jour) : le crédit revient. */
export async function rendreCredit(moisId: string | null): Promise<void> {
  if (!moisId) return;
  await db
    .update(assistantMonths)
    .set({ used: sql`${assistantMonths.used} - 1` })
    .where(and(eq(assistantMonths.id, moisId), sql`${assistantMonths.used} > 0`));
}

/** Plus que 10 conversations, ou plus aucune : le propriétaire et les gérants sont prévenus (abonnement seulement). */
export async function prevenirSiPeuDeCredits(ctx: BusinessContext, o: Extract<Ouverture, { ok: true }>): Promise<void> {
  if (o.genre !== "abonnement" || (o.restants !== 10 && o.restants !== 0)) return;
  const rappel = o.restants === 0 ? "zero" : "dix";
  await db.transaction((tx) => notify(tx, ctx, messageAssistant(rappel)));
}
```

- [ ] **Step 3: Remplacer le contrôle « assistant activé » dans `src/server/assistant/contexte.ts`**

Ajouter l'import :

```ts
import { boutonAssistantVisible } from "@/lib/domain/assistant/abonnement";
```

Remplacer le commentaire et la ligne :

```ts
/** Contrôles communs aux adresses de l'assistant : session, commerce, suspension, assistant activé. */
```

```ts
  if (!ctx.business.assistantEnabled) return { ok: false, reponse: refuser("L'assistant vocal n'est pas activé pour ce commerce.", 403) };
```

par :

```ts
/** Contrôles communs aux adresses de l'assistant : session, commerce, suspension, droit à Finch (les crédits se comptent à l'ouverture). */
```

```ts
  if (!boutonAssistantVisible(ctx.plan, ctx.business.isDemo)) return { ok: false, reponse: refuser("Finch n'est pas disponible pour ce commerce.", 403) };
```

- [ ] **Step 4: Réécrire `src/app/api/assistant/session/route.ts`**

```ts
import { NextResponse } from "next/server";
import { ficheAssistant } from "@/lib/domain/assistant/abonnement";
import { buildSystemPrompt } from "@/lib/domain/assistant/prompt";
import { toolDeclarations } from "@/lib/domain/assistant/tools";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { LEGAL } from "@/lib/legal";
import { ouvrirConversation, prevenirSiPeuDeCredits, rendreCredit } from "@/server/assistant/abonnement";
import { accesEcrans, contexteAssistant, NO_STORE, outilsDirects, refuser } from "@/server/assistant/contexte";
import { creerJetonDirect, GeminiError } from "@/server/assistant/direct";
import { consumeAssistantQuota } from "@/server/assistant/usage";
import { listProducts } from "@/server/queries/products";

/**
 * Ouvre une conversation en direct : un crédit est retiré (abonnement ou essai ; rien pour une démonstration), puis une
 * clé temporaire à usage unique fige le modèle, la voix, les consignes (catalogue compris) et les outils du rôle.
 * Si Google refuse ou si la limite de sécurité du jour est atteinte, le crédit revient.
 */
export async function POST() {
  const verif = await contexteAssistant();
  if (!verif.ok) return verif.reponse;
  const { ctx } = verif;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return refuser("L'assistant vocal n'est pas encore configuré.", 503);

  const ouverture = await ouvrirConversation(ctx);
  if (!ouverture.ok) {
    const fiche = ficheAssistant(ouverture.etat, { boutique: ctx.business.name, peutPayer: ctx.can("billing.manage"), support: LEGAL.whatsapp });
    return NextResponse.json({ error: fiche?.titre ?? "Finch n'est pas disponible.", fiche }, { status: 402, headers: NO_STORE });
  }

  const [quota, products] = await Promise.all([consumeAssistantQuota(ctx.business.id, { isDemo: ctx.business.isDemo }), listProducts(ctx)]);
  if (!quota.allowed) {
    await rendreCredit(ouverture.moisId);
    return refuser("Limite du jour atteinte, réessaie demain.", 429);
  }

  const system = buildSystemPrompt({
    businessName: ctx.business.name,
    roleLabel: ROLE_LABELS[ctx.role],
    today: new Date(),
    products,
    acces: accesEcrans(ctx),
  });
  const tools = toolDeclarations(outilsDirects(ctx), { costs: ctx.can("costs.view") });
  try {
    const session = await creerJetonDirect({
      apiKey,
      system,
      tools,
      model: process.env.GEMINI_LIVE_MODEL || undefined,
      voice: process.env.GEMINI_LIVE_VOICE || undefined,
    });
    await prevenirSiPeuDeCredits(ctx, ouverture);
    const credits = ouverture.restants === null ? null : { restants: ouverture.restants, essai: ouverture.genre === "essai" };
    return NextResponse.json({ ...session, credits }, { headers: NO_STORE });
  } catch (error) {
    await rendreCredit(ouverture.moisId);
    if (error instanceof GeminiError) {
      console.error("[assistant] session", error.kind, error.status ?? "-");
      return refuser("L'assistant est saturé, réessaie dans une minute.", 503);
    }
    throw error;
  }
}
```

- [ ] **Step 5: Vérifier types, lint et tests de l'assistant**

Run: `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` puis `npx eslint src/server/queries/assistant.ts src/server/assistant src/app/api/assistant` puis `npx vitest run src/server/assistant src/lib/domain/assistant`
Expected: aucune erreur, tous les tests passent.

- [ ] **Step 6: Commit**

```bash
git add src/server/queries/assistant.ts src/server/assistant/abonnement.ts src/server/assistant/contexte.ts src/app/api/assistant/session/route.ts
git commit -m "feat(assistant): chaque conversation retire un crédit, rendu si Google échoue ; refus 402 avec la fiche

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fiche et compteur côté téléphone

**Files:**
- Modify: `src/components/assistant/api.ts:8-18`
- Modify: `src/components/assistant/direct/conversation.ts:2,19-27,155`
- Modify: `src/components/assistant/assistant-provider.tsx` (valeur, états, `demarrer`)
- Create: `src/components/assistant/fiche-assistant.tsx`
- Modify: `src/components/assistant/pilote/plein-ecran.tsx:66-68`
- Modify: `src/app/(app)/layout.tsx:197-204` (+ imports)

**Interfaces:**
- Consumes: Task 2 (`FicheAssistant`, `texteCredits`, `CreditsAffiches`, `boutonAssistantVisible`), Task 4 (réponse de `/api/assistant/session`).
- Produces: `interface CreditsConversation { restants: number; essai: boolean }`, `type ReponseSession` (api.ts) ; dans `AssistantValue` : `fiche: FicheAssistant | null`, `fermerFiche(): void`, `credits: CreditsAffiches | null` ; composant `FicheAbonnementAssistant`.

- [ ] **Step 1: `src/components/assistant/api.ts` — la session rend les crédits ou la fiche**

Ajouter l'import en haut :

```ts
import type { FicheAssistant } from "@/lib/domain/assistant/abonnement";
```

Remplacer `demanderSession` par :

```ts
/** Conversations restantes après l'ouverture (null : démonstration). */
export interface CreditsConversation {
  restants: number;
  essai: boolean;
}

export type ReponseSession =
  | { ok: true; jeton: string; credits: CreditsConversation | null }
  | { ok: false; error: string; fiche: FicheAssistant | null };

/** Clé temporaire pour une conversation en direct (un crédit retiré). Refus 402 : la fiche à montrer à la place. */
export async function demanderSession(): Promise<ReponseSession> {
  try {
    const res = await fetch("/api/assistant/session", { method: "POST", headers: JSON_HEADERS });
    const data = (await res.json().catch(() => null)) as {
      jeton?: string;
      credits?: CreditsConversation | null;
      error?: string;
      fiche?: FicheAssistant | null;
    } | null;
    if (!res.ok || !data?.jeton) return { ok: false, error: data?.error ?? "L'assistant ne répond pas. Réessaie.", fiche: data?.fiche ?? null };
    return { ok: true, jeton: data.jeton, credits: data.credits ?? null };
  } catch {
    return { ok: false, error: "Pas de connexion internet.", fiche: null };
  }
}
```

- [ ] **Step 2: `src/components/assistant/direct/conversation.ts` — relayer la fiche et les crédits**

Remplacer `import { demanderSession } from "../api";` par :

```ts
import type { FicheAssistant } from "@/lib/domain/assistant/abonnement";
import { demanderSession, type CreditsConversation } from "../api";
```

Dans `OptionsConversation`, après `surOutilsAnnules(ids: string[]): void;`, ajouter :

```ts
  /** Finch n'est pas payé ou n'a plus de crédits : la fiche à montrer à la place de la conversation. */
  surFiche(fiche: FicheAssistant): void;
  /** Conversations restantes, connues à l'ouverture (null : démonstration). */
  surCredits(credits: CreditsConversation | null): void;
```

Remplacer :

```ts
    if (!session.ok) return terminer(session.error);
```

par :

```ts
    if (!session.ok) {
      if (session.fiche) o.surFiche(session.fiche);
      return terminer(session.fiche ? null : session.error);
    }
    o.surCredits(session.credits);
```

- [ ] **Step 3: `src/components/assistant/assistant-provider.tsx` — états `fiche` et `credits`**

Ajouter l'import :

```ts
import { texteCredits, type CreditsAffiches, type FicheAssistant } from "@/lib/domain/assistant/abonnement";
```

Dans `interface AssistantValue`, juste avant `fermerStatut: () => void;`, ajouter :

```ts
  /** Fiche montrée quand Finch n'est pas payé ou n'a plus de crédits (activer, renouveler, recharger). */
  fiche: FicheAssistant | null;
  fermerFiche: () => void;
  /** Conversations restantes de la conversation en cours (null : démonstration ou pas de conversation). */
  credits: CreditsAffiches | null;
```

Juste après la ligne `const [resume, setResume] = useState<string | null>(null);`, ajouter :

```ts
  const [fiche, setFiche] = useState<FicheAssistant | null>(null);
  const [credits, setCredits] = useState<CreditsAffiches | null>(null);
```

Dans `demarrer()`, remplacer :

```ts
    setNotice(null);
    setPhase("connexion");
```

par :

```ts
    setNotice(null);
    setFiche(null);
    setCredits(null);
    setPhase("connexion");
```

Dans l'appel `creerConversation({ … })`, après `surOutilsAnnules,`, ajouter :

```ts
      surFiche: setFiche,
      surCredits: (c) => setCredits(c ? texteCredits(c.restants, c.essai) : null),
```

Dans `surFin`, après `setGeste(null);`, ajouter `setCredits(null);`.

Dans `const value: AssistantValue = { … }`, juste avant `fermerStatut: () => {`, ajouter :

```ts
    fiche,
    fermerFiche: () => setFiche(null),
    credits,
```

- [ ] **Step 4: Créer `src/components/assistant/fiche-assistant.tsx`**

```tsx
"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAssistant } from "./assistant-provider";

/** Finch n'est pas payé ou n'a plus de crédits : ce qu'il faut faire, et le bouton WhatsApp vers Sama Stock. */
export function FicheAbonnementAssistant() {
  const a = useAssistant();
  const fiche = a.fiche;
  return (
    <Dialog
      open={fiche !== null}
      onOpenChange={(open) => {
        if (!open) a.fermerFiche();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fiche?.titre}</DialogTitle>
          <DialogDescription>{fiche?.texte}</DialogDescription>
        </DialogHeader>
        {fiche?.lien && fiche.bouton && (
          <DialogFooter>
            <Button asChild>
              <a href={fiche.lien} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> {fiche.bouton}
              </a>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: `src/components/assistant/pilote/plein-ecran.tsx` — le compteur**

`cn` est déjà importé dans ce fichier ; remplacer :

```tsx
        <p aria-live="polite" className="min-h-7 px-6 text-center text-lg font-medium text-white/90 sm:text-xl">
          {a.statut ?? STATUTS[a.phase]}
        </p>
```

par :

```tsx
        <div className="flex flex-col items-center gap-2">
          <p aria-live="polite" className="min-h-7 px-6 text-center text-lg font-medium text-white/90 sm:text-xl">
            {a.statut ?? STATUTS[a.phase]}
          </p>
          {a.credits && <p className={cn("text-sm font-medium", a.credits.alerte ? "text-amber-300" : "text-white/55")}>{a.credits.texte}</p>}
        </div>
```

- [ ] **Step 6: `src/app/(app)/layout.tsx` — micro selon le statut, fiche montée**

Ajouter les imports :

```ts
import { FicheAbonnementAssistant } from "@/components/assistant/fiche-assistant";
import { boutonAssistantVisible } from "@/lib/domain/assistant/abonnement";
```

Remplacer :

```tsx
          {ctx.business.assistantEnabled && (
            <AssistantProvider>
              <AssistantButton />
              <PleinEcranAssistant />
              <BulleAssistant />
              <DoigtAssistant />
            </AssistantProvider>
          )}
```

par :

```tsx
          {boutonAssistantVisible(ctx.plan, ctx.business.isDemo) && (
            <AssistantProvider>
              <AssistantButton />
              <PleinEcranAssistant />
              <BulleAssistant />
              <DoigtAssistant />
              <FicheAbonnementAssistant />
            </AssistantProvider>
          )}
```

- [ ] **Step 7: Vérifier types, lint et tests de l'assistant**

Run: `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` puis `npx eslint src/components/assistant "src/app/(app)/layout.tsx"` puis `npx vitest run src/components/assistant`
Expected: aucune erreur ; tests passent.

- [ ] **Step 8: Commit**

```bash
git add src/components/assistant "src/app/(app)/layout.tsx"
git commit -m "feat(assistant): fiche WhatsApp quand Finch n'est pas payé, compteur de conversations pendant l'échange

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Rappels quotidiens

**Files:**
- Modify: `src/server/services/notifications.ts` (fonction `notifySysteme`)
- Modify: `src/server/queries/assistant.ts` (fonction `finsAbonnement`)
- Create: `src/app/api/assistant/rappels/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: Task 2 (`rappelPour`, `messageAssistant`).
- Produces: `notifySysteme(tx: Tx, businessId: string, message: NotifyMessage): Promise<void>`, `finsAbonnement(): Promise<{ businessId: string; finLe: Date }[]>`, `GET /api/assistant/rappels` (réponse `{ envoyes: number }`).

- [ ] **Step 1: Ajouter `notifySysteme` dans `src/server/services/notifications.ts`** (après `notify`)

```ts
/** Notification sans auteur (tâche planifiée) : elle part sur les téléphones du propriétaire et des gérants. */
export async function notifySysteme(tx: Tx, businessId: string, message: NotifyMessage): Promise<void> {
  const [row] = await tx
    .insert(notifications)
    .values({ businessId, kind: message.kind, title: message.title, body: message.body, href: message.href, actorId: null })
    .returning({ id: notifications.id });
  after(() => deliverPush(row!.id));
}
```

- [ ] **Step 2: Ajouter `finsAbonnement` dans `src/server/queries/assistant.ts`**

Compléter l'import : `import { asc, eq, sql } from "drizzle-orm";` puis ajouter :

```ts
/** Fin du dernier mois d'abonnement de chaque commerce (hors démonstrations). */
export async function finsAbonnement(): Promise<{ businessId: string; finLe: Date }[]> {
  const res = await db.execute<{ business_id: string; ends_at: string | Date }>(sql`
    select distinct on (m.business_id) m.business_id, m.ends_at
    from assistant_months m join businesses b on b.id = m.business_id
    where m.kind = 'abonnement' and not b.is_demo
    order by m.business_id, m.ends_at desc`);
  return res.rows.map((r) => ({ businessId: r.business_id, finLe: new Date(r.ends_at) }));
}
```

- [ ] **Step 3: Créer `src/app/api/assistant/rappels/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { messageAssistant, rappelPour } from "@/lib/domain/assistant/abonnement";
import { isBackupKeyValid } from "@/server/backup/key";
import { finsAbonnement } from "@/server/queries/assistant";
import { notifySysteme } from "@/server/services/notifications";

export const maxDuration = 60;

/** Tâche du matin (planifiée par Vercel, 9 h à Dakar) : prévient les commerces dont l'abonnement Finch se termine. */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const now = new Date();
  let envoyes = 0;
  for (const { businessId, finLe } of await finsAbonnement()) {
    const rappel = rappelPour(finLe, now);
    if (!rappel) continue;
    await db.transaction((tx) => notifySysteme(tx, businessId, messageAssistant(rappel, finLe)));
    envoyes++;
  }
  return NextResponse.json({ envoyes });
}
```

- [ ] **Step 4: Déclarer la tâche dans `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "crons": [
    { "path": "/api/sauvegardes/nuit", "schedule": "0 2 * * *" },
    { "path": "/api/assistant/rappels", "schedule": "0 9 * * *" }
  ]
}
```

- [ ] **Step 5: Vérifier types et lint**

Run: `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` puis `npx eslint src/server/services/notifications.ts src/server/queries/assistant.ts src/app/api/assistant/rappels`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/notifications.ts src/server/queries/assistant.ts src/app/api/assistant/rappels vercel.json
git commit -m "feat(assistant): rappels de fin d'abonnement Finch chaque matin à 9 h

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Section « Assistant Finch » de la fiche commerce (administration)

**Files:**
- Modify: `src/server/queries/assistant.ts` (fonction `paiementsDuCommerce`)
- Create: `src/server/actions/assistant-abonnement.ts`
- Create: `src/components/admin/assistant/assistant-forms.tsx`
- Create: `src/components/admin/assistant/assistant-card.tsx`
- Modify: `src/app/admin/commerces/[id]/page.tsx`
- Modify: `src/components/admin/admin-actions.tsx` (retrait de l'interrupteur)
- Modify: `src/server/actions/admin.ts:170-185` (retrait de `adminSetAssistant`)
- Modify: `src/server/queries/admin.ts` (retrait de `assistantEnabled` du `select`)

**Interfaces:**
- Consumes: Task 1-4 (`planifierMois`, `peutAnnuler`, `libellePaiement`, `montantParDefaut`, `STATUTS_ASSISTANT`, `etatAssistant`, `moisDuCommerce`, tables).
- Produces: `interface PaiementAssistantVue { id; kind: GenrePaiement; months; credits; amount; method: string; note: string | null; paidAt: Date; recordedBy: string | null; annulable: boolean }`, `paiementsDuCommerce(businessId): Promise<PaiementAssistantVue[]>` ; actions `adminActiverAssistant(businessId, { months, amount, method, note })`, `adminRenouvelerAssistant(businessId, { months, amount, method, note })`, `adminRechargerAssistant(businessId, { amount, method, note })`, `adminAnnulerPaiementAssistant(paymentId)` (toutes rendent `ActionResult<null>`) ; composants `AssistantAdminCard`, `AssistantPaymentForm`, `AnnulerPaiementAssistant`.

- [ ] **Step 1: Ajouter `paiementsDuCommerce` dans `src/server/queries/assistant.ts`**

Compléter les imports :

```ts
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantMonths, assistantPayments, user } from "@/db/schema";
import { peutAnnuler, type GenrePaiement, type MoisAssistant } from "@/lib/domain/assistant/abonnement";
```

puis ajouter :

```ts
export interface PaiementAssistantVue {
  id: string;
  kind: GenrePaiement;
  months: number;
  credits: number;
  amount: number;
  method: string;
  note: string | null;
  paidAt: Date;
  /** Administrateur qui l'a saisi (jamais montré au commerçant). */
  recordedBy: string | null;
  /** Dernier paiement saisi, dont les crédits n'ont pas servi. */
  annulable: boolean;
}

const genre = (k: string): GenrePaiement => (k === "activation" || k === "recharge" ? k : "mois");

/** Le mois d'abonnement qui portait une recharge (celui qui couvrait sa date de paiement). */
export function moisDeRecharge(mois: readonly MoisAssistant[], paidAt: Date): MoisAssistant | null {
  return mois.find((m) => m.kind === "abonnement" && m.startsAt <= paidAt && m.endsAt > paidAt) ?? null;
}

/** Paiements de Finch d'un commerce, du plus récent au plus ancien. */
export async function paiementsDuCommerce(businessId: string): Promise<PaiementAssistantVue[]> {
  const [rows, mois] = await Promise.all([
    db
      .select({
        id: assistantPayments.id,
        kind: assistantPayments.kind,
        months: assistantPayments.months,
        credits: assistantPayments.credits,
        amount: assistantPayments.amount,
        method: assistantPayments.method,
        note: assistantPayments.note,
        paidAt: assistantPayments.paidAt,
        recordedBy: user.name,
      })
      .from(assistantPayments)
      .leftJoin(user, eq(user.id, assistantPayments.recordedBy))
      .where(eq(assistantPayments.businessId, businessId))
      .orderBy(desc(assistantPayments.createdAt)),
    moisDuCommerce(businessId),
  ]);
  return rows.map((p, i) => {
    const kind = genre(p.kind);
    const crees = mois.filter((m) => m.paymentId === p.id);
    const cible = kind === "recharge" ? moisDeRecharge(mois, p.paidAt) : null;
    return { ...p, kind, annulable: i === 0 && peutAnnuler({ kind, credits: p.credits }, crees, cible) };
  });
}
```

- [ ] **Step 2: Créer `src/server/actions/assistant-abonnement.ts`**

```ts
"use server";

import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { assistantMonths, assistantPayments, businesses } from "@/db/schema";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { libellePaiement, peutAnnuler, planifierMois, type GenrePaiement } from "@/lib/domain/assistant/abonnement";
import { ASSISTANT_OFFERS, ASSISTANT_RECHARGE, ASSISTANT_RENEW_MAX_MONTHS, computePlanState, type LicensePackId } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { ActionError, parse, runAction } from "../action";
import { type AppContext, requireSuperAdminAction } from "../context";
import { moisDeRecharge, moisDuCommerce } from "../queries/assistant";
import { logAdmin } from "../services/admin-audit";

const METHODS = Object.keys(LICENSE_PAYMENT_METHODS) as [LicensePaymentMethod, ...LicensePaymentMethod[]];
const argent = {
  amount: z.coerce.number().int("Montant en francs entiers.").min(0, "Montant invalide.").max(10_000_000),
  method: z.enum(METHODS, { message: "Choisissez le moyen de paiement." }),
  note: z.string().trim().max(200).optional().default(""),
};
const moisSchema = z.object({
  months: z.coerce.number().int().min(1, "Au moins 1 mois.").max(ASSISTANT_RENEW_MAX_MONTHS, `${ASSISTANT_RENEW_MAX_MONTHS} mois au plus par saisie.`),
  ...argent,
});
const rechargeSchema = z.object(argent);

async function commerceSousLicence(businessId: string): Promise<LicensePackId> {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!b) throw new ActionError("Commerce introuvable.");
  if (b.isDemo) throw new ActionError("Les démonstrations ont Finch gratuitement.");
  const offre = computePlanState(b).license;
  if (!offre) throw new ActionError("Finch s'active sur un commerce sous licence.");
  return offre;
}

async function dejaActive(businessId: string): Promise<boolean> {
  const [p] = await db
    .select({ id: assistantPayments.id })
    .from(assistantPayments)
    .where(and(eq(assistantPayments.businessId, businessId), eq(assistantPayments.kind, "activation")))
    .limit(1);
  return Boolean(p);
}

/** Enregistre l'argent reçu et ouvre les mois qui suivent la fin actuelle (ou aujourd'hui). */
async function ajouterMois(ctx: AppContext, businessId: string, offre: LicensePackId, kind: "activation" | "mois", data: z.infer<typeof moisSchema>) {
  const fenetres = planifierMois(await moisDuCommerce(businessId), data.months);
  await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(assistantPayments)
      .values({ businessId, kind, months: data.months, amount: data.amount, method: data.method, note: data.note || null, recordedBy: ctx.user.id })
      .returning({ id: assistantPayments.id });
    await tx.insert(assistantMonths).values(
      fenetres.map((f) => ({ businessId, kind: "abonnement", startsAt: f.startsAt, endsAt: f.endsAt, credits: ASSISTANT_OFFERS[offre].monthlyCredits, paymentId: p!.id })),
    );
    await logAdmin(tx, ctx, {
      action: "assistant",
      businessId,
      summary: `${kind === "activation" ? "Finch activé" : "Finch renouvelé"} : ${libellePaiement({ kind, months: data.months, credits: 0 })}, ${formatFCFA(data.amount)} (${LICENSE_PAYMENT_METHODS[data.method]}), jusqu'au ${formatDate(fenetres.at(-1)!.endsAt)}`,
    });
  });
}

/** Activation de Finch (une fois) avec ses premiers mois. */
export async function adminActiverAssistant(businessId: string, input: z.input<typeof moisSchema>) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const data = parse(moisSchema, input);
    const offre = await commerceSousLicence(businessId);
    if (await dejaActive(businessId)) throw new ActionError("Finch est déjà activé : utilisez « Renouveler ».");
    await ajouterMois(ctx, businessId, offre, "activation", data);
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** 1 à 12 mois de plus, à la suite des mois déjà payés. */
export async function adminRenouvelerAssistant(businessId: string, input: z.input<typeof moisSchema>) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const data = parse(moisSchema, input);
    const offre = await commerceSousLicence(businessId);
    if (!(await dejaActive(businessId))) throw new ActionError("Activez d'abord Finch (activation et premiers mois).");
    await ajouterMois(ctx, businessId, offre, "mois", data);
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** +50 conversations, valables jusqu'à la fin du mois en cours. */
export async function adminRechargerAssistant(businessId: string, input: z.input<typeof rechargeSchema>) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const data = parse(rechargeSchema, input);
    await commerceSousLicence(businessId);
    const now = new Date();
    const [mois] = await db
      .select({ id: assistantMonths.id, endsAt: assistantMonths.endsAt })
      .from(assistantMonths)
      .where(and(eq(assistantMonths.businessId, businessId), eq(assistantMonths.kind, "abonnement"), lte(assistantMonths.startsAt, now), gt(assistantMonths.endsAt, now)))
      .limit(1);
    if (!mois) throw new ActionError("Aucun mois en cours : renouvelez d'abord l'abonnement.");
    await db.transaction(async (tx) => {
      await tx
        .update(assistantMonths)
        .set({ extraCredits: sql`${assistantMonths.extraCredits} + ${ASSISTANT_RECHARGE.credits}` })
        .where(eq(assistantMonths.id, mois.id));
      await tx.insert(assistantPayments).values({
        businessId,
        kind: "recharge",
        credits: ASSISTANT_RECHARGE.credits,
        amount: data.amount,
        method: data.method,
        note: data.note || null,
        recordedBy: ctx.user.id,
        paidAt: now,
      });
      await logAdmin(tx, ctx, {
        action: "assistant",
        businessId,
        summary: `Recharge de Finch : +${ASSISTANT_RECHARGE.credits} conversations jusqu'au ${formatDate(mois.endsAt)}, ${formatFCFA(data.amount)} (${LICENSE_PAYMENT_METHODS[data.method]})`,
      });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** Annule le dernier paiement saisi d'un commerce, tant que ses crédits n'ont pas servi. */
export async function adminAnnulerPaiementAssistant(paymentId: string) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const [p] = await db.select().from(assistantPayments).where(eq(assistantPayments.id, paymentId));
    if (!p) throw new ActionError("Paiement introuvable.");
    const [dernier] = await db
      .select({ id: assistantPayments.id })
      .from(assistantPayments)
      .where(eq(assistantPayments.businessId, p.businessId))
      .orderBy(desc(assistantPayments.createdAt))
      .limit(1);
    if (dernier?.id !== p.id) throw new ActionError("Seul le dernier paiement saisi peut être annulé.");
    const kind: GenrePaiement = p.kind === "activation" || p.kind === "recharge" ? p.kind : "mois";
    const mois = await moisDuCommerce(p.businessId);
    const crees = mois.filter((m) => m.paymentId === p.id);
    const cible = kind === "recharge" ? moisDeRecharge(mois, p.paidAt) : null;
    if (!peutAnnuler({ kind, credits: p.credits }, crees, cible)) {
      throw new ActionError("Des conversations ont déjà été utilisées avec ce paiement : il ne peut plus être annulé.");
    }
    await db.transaction(async (tx) => {
      if (cible) {
        await tx
          .update(assistantMonths)
          .set({ extraCredits: sql`${assistantMonths.extraCredits} - ${p.credits}` })
          .where(eq(assistantMonths.id, cible.id));
      }
      await tx.delete(assistantMonths).where(eq(assistantMonths.paymentId, p.id));
      await tx.delete(assistantPayments).where(eq(assistantPayments.id, p.id));
      await logAdmin(tx, ctx, {
        action: "assistant",
        businessId: p.businessId,
        summary: `Paiement de Finch annulé : ${libellePaiement({ kind, months: p.months, credits: p.credits })}, ${formatFCFA(p.amount)}`,
      });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}
```

- [ ] **Step 3: Créer `src/components/admin/assistant/assistant-forms.tsx`**

```tsx
"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { FormField, SuffixInput } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { montantParDefaut, type GenrePaiement } from "@/lib/domain/assistant/abonnement";
import { ASSISTANT_RECHARGE, ASSISTANT_RENEW_MAX_MONTHS, type LicensePackId } from "@/lib/domain/plans";
import { cn } from "@/lib/utils";
import { adminActiverAssistant, adminAnnulerPaiementAssistant, adminRechargerAssistant, adminRenouvelerAssistant } from "@/server/actions/assistant-abonnement";

const TITRES: Record<GenrePaiement, [string, string]> = {
  activation: ["Activation", "Une fois, avec les premiers mois"],
  mois: ["Renouveler", `1 à ${ASSISTANT_RENEW_MAX_MONTHS} mois, à la suite`],
  recharge: ["Recharge", `+${ASSISTANT_RECHARGE.credits} conversations ce mois-ci`],
};

/** Saisie d'un paiement de Finch : activation, renouvellement ou recharge, montant pré-rempli au prix catalogue. */
export function AssistantPaymentForm({ businessId, offre, choix }: { businessId: string; offre: LicensePackId; choix: GenrePaiement[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<GenrePaiement>(choix[0]);
  const [months, setMonths] = useState("1");
  const [amount, setAmount] = useState(String(montantParDefaut(offre, choix[0], 1)));
  const [method, setMethod] = useState<LicensePaymentMethod>("wave");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  function choisir(k: GenrePaiement) {
    setKind(k);
    setAmount(String(montantParDefaut(offre, k, Number(months) || 1)));
  }

  function changerMois(v: string) {
    setMonths(v);
    setAmount(String(montantParDefaut(offre, kind, Number(v) || 1)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res =
      kind === "activation"
        ? await adminActiverAssistant(businessId, { months, amount, method, note })
        : kind === "mois"
          ? await adminRenouvelerAssistant(businessId, { months, amount, method, note })
          : await adminRechargerAssistant(businessId, { amount, method, note });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(kind === "recharge" ? `${ASSISTANT_RECHARGE.credits} conversations ajoutées` : kind === "activation" ? "Finch activé" : "Finch renouvelé");
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {choix.length > 1 && (
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {choix.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => choisir(k)}
              className={cn("rounded-xl border p-3 text-left text-sm", kind === k && "border-primary bg-accent/50 ring-1 ring-primary")}
            >
              <span className="block font-semibold">{TITRES[k][0]}</span>
              <span className="block text-xs text-muted-foreground">{TITRES[k][1]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {kind !== "recharge" && (
          <FormField label="Mois payés" htmlFor="finch-mois">
            <Input id="finch-mois" type="number" min={1} max={ASSISTANT_RENEW_MAX_MONTHS} inputMode="numeric" value={months} onChange={(e) => changerMois(e.target.value)} />
          </FormField>
        )}
        <FormField label="Montant reçu" htmlFor="finch-montant">
          <SuffixInput id="finch-montant" suffix="FCFA" min={0} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <FormField label="Payé par">
          <Select value={method} onValueChange={(v) => setMethod(v as LicensePaymentMethod)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(LICENSE_PAYMENT_METHODS) as [LicensePaymentMethod, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Note (facultatif)" htmlFor="finch-note">
        <Input id="finch-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : payé par Wave le matin" />
      </FormField>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending && <Loader2 className="animate-spin" />}
        {kind === "activation" ? "Activer Finch" : kind === "mois" ? "Enregistrer et renouveler" : "Enregistrer la recharge"}
      </Button>
    </form>
  );
}

/** Annule le dernier paiement saisi (erreur de saisie), tant que ses crédits n'ont pas servi. */
export function AnnulerPaiementAssistant({ paymentId }: { paymentId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm">
          <Undo2 /> Annuler
        </Button>
      }
      title="Annuler ce paiement ?"
      description="Le paiement et les conversations qu'il ouvrait sont retirés. À faire seulement après une erreur de saisie."
      confirmLabel="Annuler le paiement"
      destructive
      successMessage="Paiement annulé"
      action={() => adminAnnulerPaiementAssistant(paymentId)}
    />
  );
}
```

(`ConfirmAction` attend `action: (typed: string) => Promise<ActionResult<unknown>>` : la fonction ci-dessus ignore le texte tapé.)

- [ ] **Step 4: Créer `src/components/admin/assistant/assistant-card.tsx`**

```tsx
import { Mic } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { libellePaiement, STATUTS_ASSISTANT, type EtatAssistant, type GenrePaiement } from "@/lib/domain/assistant/abonnement";
import { ASSISTANT_OFFERS, LICENSE_PACKS, type LicensePackId } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaiementAssistantVue } from "@/server/queries/assistant";
import { AnnulerPaiementAssistant, AssistantPaymentForm } from "./assistant-forms";

const methode = (m: string) => LICENSE_PAYMENT_METHODS[m as LicensePaymentMethod] ?? m;

/** Abonnement de Finch d'un commerce sous licence : état, saisie des paiements, historique. */
export function AssistantAdminCard({
  businessId,
  offre,
  etat,
  paiements,
}: {
  businessId: string;
  offre: LicensePackId;
  etat: EtatAssistant;
  paiements: PaiementAssistantVue[];
}) {
  const o = ASSISTANT_OFFERS[offre];
  const active = paiements.some((p) => p.kind === "activation");
  const choix: GenrePaiement[] = !active ? ["activation"] : etat.statut === "actif" || etat.statut === "epuise" ? ["mois", "recharge"] : ["mois"];
  const utilise = etat.total > 0 ? Math.round(((etat.total - etat.restants) / etat.total) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold">
          <Mic className="size-4 text-primary" /> Assistant Finch
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Offre {LICENSE_PACKS[offre].label}</p>
            <p className="font-semibold">
              {o.monthlyCredits} conversations · {formatFCFA(o.monthlyPrice)} / mois
            </p>
            <p className="text-xs text-muted-foreground">Activation {formatFCFA(o.activationPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">État</p>
            <p className="font-semibold">
              {STATUTS_ASSISTANT[etat.statut]}
              {etat.finLe && <span className="text-muted-foreground"> · jusqu&apos;au {formatDate(etat.finLe)}</span>}
            </p>
            {etat.mois && (
              <>
                <p className="text-xs text-muted-foreground">
                  {etat.restants} conversations restantes sur {etat.total}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", etat.restants <= 10 ? "bg-saffron" : "bg-primary")} style={{ width: `${utilise}%` }} />
                </div>
              </>
            )}
          </div>
        </div>
        <AssistantPaymentForm businessId={businessId} offre={offre} choix={choix} />
        {paiements.length > 0 && (
          <ul className="divide-y rounded-xl border text-sm">
            {paiements.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div>
                  <p className="font-medium">
                    {libellePaiement(p)} · {formatFCFA(p.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(p.paidAt)} · {methode(p.method)}
                    {p.recordedBy && ` · ${p.recordedBy}`}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                {p.annulable && <AnnulerPaiementAssistant paymentId={p.id} />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Brancher la carte dans `src/app/admin/commerces/[id]/page.tsx`**

Ajouter les imports :

```ts
import { AssistantAdminCard } from "@/components/admin/assistant/assistant-card";
import { etatAssistant } from "@/lib/domain/assistant/abonnement";
import { moisDuCommerce, paiementsDuCommerce } from "@/server/queries/assistant";
```

Après `const licence = activeSale ? await getLicenseSale(activeSale.id) : null;`, ajouter :

```ts
  const [moisFinch, paiementsFinch] = s.license ? await Promise.all([moisDuCommerce(id), paiementsDuCommerce(id)]) : [[], []];
  const etatFinch = etatAssistant({ isDemo: false, plan: s, mois: moisFinch });
```

Remplacer :

```tsx
              <LicenseCard detail={licence} />
              <AdminActions businessId={b.id} businessName={b.name} licensed suspended={s.status === "suspended"} assistantEnabled={b.assistantEnabled} />
```

par :

```tsx
              <LicenseCard detail={licence} />
              {s.license && <AssistantAdminCard businessId={b.id} offre={s.license} etat={etatFinch} paiements={paiementsFinch} />}
              <AdminActions businessId={b.id} businessName={b.name} licensed suspended={s.status === "suspended"} />
```

et remplacer :

```tsx
                <AdminActions businessId={b.id} businessName={b.name} licensed={false} suspended={s.status === "suspended"} assistantEnabled={b.assistantEnabled} />
```

par :

```tsx
                <AdminActions businessId={b.id} businessName={b.name} licensed={false} suspended={s.status === "suspended"} />
```

- [ ] **Step 6: Retirer l'ancien interrupteur**

Dans `src/components/admin/admin-actions.tsx` :
- import lucide : retirer `Mic` (`import { Ban, CalendarPlus, CheckCircle2, TimerOff, Trash2 } from "lucide-react";`) ;
- import des actions : `import { adminDeleteBusiness, adminExpireNow, adminExtend, adminSetSuspended } from "@/server/actions/admin";` ;
- props : retirer `assistantEnabled,` de la déstructuration et `assistantEnabled: boolean;` du type ;
- supprimer en entier la `<section>` qui commence par `<Mic className="size-4 text-primary" /> Assistant vocal (wolof / français)` (jusqu'à son `</section>` fermant, avant la section « Supprimer définitivement »).

Dans `src/server/actions/admin.ts`, supprimer la fonction `adminSetAssistant` en entier (lignes 170-185).

Dans `src/server/queries/admin.ts`, supprimer la ligne `assistantEnabled: businesses.assistantEnabled,` du `select` de `listAllBusinesses`.

Run: `grep -rn "assistantEnabled\|adminSetAssistant" src --include=*.ts --include=*.tsx`
Expected: plus que `src/db/schema/app.ts`, `src/server/backup/tables.ts` (colonne gardée), `src/server/demo/index.ts` et `src/server/demo/seed.ts` (traités à la tâche 10).

- [ ] **Step 7: Vérifier types, lint et tests**

Run: `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` puis `npx eslint src/server/actions src/server/queries src/components/admin "src/app/admin/commerces/[id]/page.tsx"` puis `npx vitest run`
Expected: aucune erreur ; toute la suite passe.

- [ ] **Step 8: Commit**

```bash
git add src/server/queries/assistant.ts src/server/actions/assistant-abonnement.ts src/server/actions/admin.ts src/server/queries/admin.ts src/components/admin "src/app/admin/commerces/[id]/page.tsx"
git commit -m "feat(admin): section Assistant Finch (activer, renouveler, recharger, annuler) à la place de l'interrupteur

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Accueil de l'administration — à renouveler et rentabilité

**Files:**
- Modify: `src/server/queries/assistant.ts` (fonctions `aRenouveler`, `rentabiliteDuMois`)
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: Task 2 (`rentabilite`, `Rentabilite`), Task 3 (tables), `assistantUsage`.
- Produces: `interface ARenouveler { businessId; name; phone: string | null; finLe: Date; used: number; total: number }`, `aRenouveler(): Promise<ARenouveler[]>`, `rentabiliteDuMois(now?): Promise<Rentabilite>`.

- [ ] **Step 1: Ajouter les deux lectures dans `src/server/queries/assistant.ts`**

Compléter les imports : `import { and, asc, desc, eq, gte, sql } from "drizzle-orm";`, ajouter `assistantUsage, businesses` à l'import du schéma et `rentabilite, type Rentabilite` à celui du domaine. Puis :

```ts
export interface ARenouveler {
  businessId: string;
  name: string;
  phone: string | null;
  finLe: Date;
  used: number;
  total: number;
}

/** Abonnements qui finissent dans les 7 jours sans mois payé ensuite, ou expirés depuis moins de 30 jours. */
export async function aRenouveler(): Promise<ARenouveler[]> {
  const res = await db.execute<{ business_id: string; name: string; phone: string | null; ends_at: string | Date; used: number; total: number }>(sql`
    select * from (
      select distinct on (m.business_id) m.business_id, b.name, b.phone, m.ends_at, m.used, m.credits + m.extra_credits as total
      from assistant_months m join businesses b on b.id = m.business_id
      where m.kind = 'abonnement' and not b.is_demo
      order by m.business_id, m.ends_at desc
    ) d
    where d.ends_at < now() + interval '7 days' and d.ends_at > now() - interval '30 days'
    order by d.ends_at asc`);
  return res.rows.map((r) => ({ businessId: r.business_id, name: r.name, phone: r.phone, finLe: new Date(r.ends_at), used: Number(r.used), total: Number(r.total) }));
}

/** Argent encaissé pour Finch et conversations du mois en cours (calendrier, Dakar = UTC), hors démonstrations. */
export async function rentabiliteDuMois(now = new Date()): Promise<Rentabilite> {
  const debut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [[encaisse], [conversations]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${assistantPayments.amount}), 0)` })
      .from(assistantPayments)
      .innerJoin(businesses, eq(businesses.id, assistantPayments.businessId))
      .where(and(gte(assistantPayments.paidAt, debut), eq(businesses.isDemo, false))),
    db
      .select({ total: sql<number>`coalesce(sum(${assistantUsage.count}), 0)` })
      .from(assistantUsage)
      .innerJoin(businesses, eq(businesses.id, assistantUsage.businessId))
      .where(and(gte(assistantUsage.day, debut.toISOString().slice(0, 10)), eq(businesses.isDemo, false))),
  ]);
  return rentabilite(Number(encaisse?.total ?? 0), Number(conversations?.total ?? 0));
}
```

- [ ] **Step 2: Afficher les deux cartes dans `src/app/admin/page.tsx`**

Ajouter les imports :

```ts
import { Mic } from "lucide-react";
import { ASSISTANT_COST_PER_CONVERSATION } from "@/lib/domain/plans";
import { formatPhone } from "@/lib/format";
import { aRenouveler, rentabiliteDuMois } from "@/server/queries/assistant";
```

(fusionner `Mic` avec l'import `lucide-react` existant et `formatPhone` avec l'import de `@/lib/format` existant). Juste après le `Promise.all` du début de `AdminDashboardPage`, ajouter :

```ts
  const [finchARenouveler, finchRentabilite] = await Promise.all([aRenouveler(), rentabiliteDuMois()]);
```

Juste avant la carte « Nouveaux commerces (30 derniers jours) », insérer :

```tsx
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-semibold">
                <Mic className="size-4 text-primary" /> Assistant : à renouveler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {finchARenouveler.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun abonnement Finch ne finit dans les 7 prochains jours.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {finchARenouveler.map((r) => (
                    <li key={r.businessId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link href={`/admin/commerces/${r.businessId}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <span className="text-muted-foreground">
                        {r.finLe < new Date() ? "Expiré le" : "Finit le"} {formatDate(r.finLe)} · {r.used}/{r.total} conversations
                        {r.phone && ` · ${formatPhone(r.phone)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Rentabilité de l&apos;assistant (ce mois-ci)</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Encaissé</dt>
                  <dd className="num text-lg font-semibold">{formatFCFA(finchRentabilite.encaisse)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Conversations</dt>
                  <dd className="num text-lg font-semibold">{formatNumber(finchRentabilite.conversations)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Coût Google estimé</dt>
                  <dd className="num text-lg font-semibold">{formatFCFA(finchRentabilite.cout)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Marge</dt>
                  <dd className={cn("num text-lg font-semibold", finchRentabilite.marge < 0 && "text-destructive")}>{formatFCFA(finchRentabilite.marge)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Estimation à {formatFCFA(ASSISTANT_COST_PER_CONVERSATION)} par conversation : ajustez `ASSISTANT_COST_PER_CONVERSATION` (src/lib/domain/plans.ts) avec la facture Google.
              </p>
            </CardContent>
          </Card>
        </div>
```

(`formatPhone(phone: string)` est exporté par `src/lib/format.ts` ; `formatNumber`, `Link`, `cn`, `formatDate`, `formatFCFA` sont déjà importés par la page.)

- [ ] **Step 3: Vérifier types et lint**

Run: `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` puis `npx eslint src/server/queries/assistant.ts src/app/admin/page.tsx`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/server/queries/assistant.ts src/app/admin/page.tsx
git commit -m "feat(admin): abonnements Finch à renouveler et rentabilité de l'assistant sur l'accueil

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Carte « Assistant Finch » du commerçant (page Licence)

**Files:**
- Create: `src/components/billing/assistant-card.tsx`
- Modify: `src/app/(app)/licence/page.tsx`

**Interfaces:**
- Consumes: Task 1-2 (`etatAssistant`, `ficheAssistant`, `libellePaiement`, `STATUTS_ASSISTANT`, `texteCredits`), Task 4/7 (`moisDuCommerce`, `paiementsDuCommerce`).
- Produces: composant `AssistantCard({ etat, paiements, boutique, support })`.

- [ ] **Step 1: Créer `src/components/billing/assistant-card.tsx`**

```tsx
import { MessageCircle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { ficheAssistant, libellePaiement, STATUTS_ASSISTANT, texteCredits, type EtatAssistant } from "@/lib/domain/assistant/abonnement";
import { NOM_ASSISTANT } from "@/lib/domain/assistant/nom";
import { ASSISTANT_OFFERS } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import type { PaiementAssistantVue } from "@/server/queries/assistant";

/** Abonnement de Finch vu par le propriétaire : état, conversations restantes, paiements, contact pour payer. */
export function AssistantCard({
  etat,
  paiements,
  boutique,
  support,
}: {
  etat: EtatAssistant;
  paiements: PaiementAssistantVue[];
  boutique: string;
  support: string | null;
}) {
  const fiche = ficheAssistant(etat, { boutique, peutPayer: true, support });
  const offre = etat.offre ? ASSISTANT_OFFERS[etat.offre] : null;
  const contact = fiche
    ? { bouton: fiche.bouton, lien: fiche.lien }
    : etat.statut === "actif" && support
      ? { bouton: "Renouveler ou recharger", lien: waLink(support, `Bonjour, je veux renouveler ou recharger ${NOM_ASSISTANT} pour ${boutique}.`) }
      : null;
  const utilise = etat.total > 0 ? Math.round(((etat.total - etat.restants) / etat.total) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold">
          <Mic className="size-4 text-primary" /> Assistant {NOM_ASSISTANT}
          <span className="ml-auto text-sm font-normal text-muted-foreground">{STATUTS_ASSISTANT[etat.statut]}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fiche && <p className="text-sm text-muted-foreground">{fiche.texte}</p>}
        {etat.mois && (etat.statut === "actif" || etat.statut === "epuise" || etat.statut === "essai") && (
          <div>
            <p className="text-sm font-medium">
              {texteCredits(etat.restants, etat.statut === "essai").texte}
              {etat.statut !== "essai" && etat.finLe && <span className="text-muted-foreground"> · jusqu&apos;au {formatDate(etat.finLe)}</span>}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", etat.restants <= 10 ? "bg-saffron" : "bg-primary")} style={{ width: `${utilise}%` }} />
            </div>
          </div>
        )}
        {offre && etat.statut === "actif" && (
          <p className="text-xs text-muted-foreground">
            {offre.monthlyCredits} conversations par mois pour {formatFCFA(offre.monthlyPrice)}. Les conversations non utilisées ne passent pas au mois suivant.
          </p>
        )}
        {contact?.lien && contact.bouton && (
          <Button asChild>
            <a href={contact.lien} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> {contact.bouton}
            </a>
          </Button>
        )}
        {paiements.length > 0 && (
          <ul className="divide-y rounded-xl border text-sm">
            {paiements.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {libellePaiement(p)} <span className="text-muted-foreground">· {formatDate(p.paidAt)}</span>
                </span>
                <span className="text-muted-foreground">
                  {formatFCFA(p.amount)} · {LICENSE_PAYMENT_METHODS[p.method as LicensePaymentMethod] ?? p.method}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Brancher la carte dans `src/app/(app)/licence/page.tsx`**

Remplacer le fichier par :

```tsx
import type { Metadata } from "next";
import { AssistantCard } from "@/components/billing/assistant-card";
import { BuyLicence } from "@/components/billing/buy-licence";
import { LicenseView } from "@/components/billing/license-view";
import { etatAssistant } from "@/lib/domain/assistant/abonnement";
import { LEGAL } from "@/lib/legal";
import { requireContext } from "@/server/context";
import { moisDuCommerce, paiementsDuCommerce } from "@/server/queries/assistant";
import { activeSaleFor, getLicenseSale } from "@/server/queries/licences";

export const metadata: Metadata = { title: "Ma licence" };

/**
 * Licence achetée : « Votre application » (maintenance, paiements). Pendant l'essai : les licences à acheter.
 * Dans les deux cas, l'abonnement de l'assistant Finch en dessous.
 */
export default async function LicencePage() {
  const ctx = await requireContext("billing.manage");
  const [mois, paiements] = await Promise.all([moisDuCommerce(ctx.business.id), paiementsDuCommerce(ctx.business.id)]);
  const etat = etatAssistant({ isDemo: ctx.business.isDemo, plan: ctx.plan, mois });
  const finch = <AssistantCard etat={etat} paiements={paiements} boutique={ctx.business.name} support={LEGAL.whatsapp} />;
  if (ctx.plan.license) {
    const sale = await activeSaleFor(ctx.business.id);
    const detail = sale ? await getLicenseSale(sale.id) : null;
    return (
      <>
        <LicenseView
          detail={detail}
          businessName={ctx.business.name}
          support={LEGAL.whatsapp}
          current={{ pack: ctx.plan.license, maintenanceEndsAt: ctx.business.maintenanceEndsAt }}
        />
        <div className="mt-5">{finch}</div>
      </>
    );
  }
  return (
    <>
      <BuyLicence plan={ctx.plan} businessName={ctx.business.name} />
      {etat.statut !== "indisponible" && <div className="mt-5">{finch}</div>}
    </>
  );
}
```

- [ ] **Step 3: Vérifier types et lint**

Run: `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` puis `npx eslint src/components/billing/assistant-card.tsx "src/app/(app)/licence/page.tsx"`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/components/billing/assistant-card.tsx "src/app/(app)/licence/page.tsx"
git commit -m "feat(licence): carte Assistant Finch du commerçant (état, conversations, paiements, WhatsApp)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Démonstration, documentation

**Files:**
- Modify: `src/server/demo/index.ts:62-75`, `src/server/demo/seed.ts:76`
- Modify: `LISEZ-MOI.md` (section « Assistant vocal (wolof / français) »)

- [ ] **Step 1: La démo ne dépend plus de la colonne `assistant_enabled`**

Dans `src/server/demo/index.ts`, remplacer :

```ts
      // Une démo d'avant les licences (sans licence) ou d'avant l'assistant vocal est recréée
```

par :

```ts
      // Une démo d'avant les licences (sans licence) est recréée
```

et supprimer la ligne `          eq(businesses.assistantEnabled, true),` du `and(...)`. Dans `src/server/demo/seed.ts`, supprimer la ligne `    assistantEnabled: true,`. Si l'import `eq` ou un autre devient inutile, le retirer.

- [ ] **Step 2: Mettre à jour `LISEZ-MOI.md`**

Dans la section « Assistant vocal (wolof / français) » :
- remplacer la ligne `- \`ASSISTANT_DAILY_LIMIT\` : facultatif, nombre de conversations par commerce et par jour (60 par défaut).` par `- \`ASSISTANT_DAILY_LIMIT\` : facultatif, limite de sécurité de conversations par commerce et par jour (60 par défaut), en plus des crédits.` ;
- remplacer l'étape « 2. **Activation** : … Le bouton micro apparaît dans son application. » par :

```markdown
2. **Abonnement** : Finch se paie à part de la licence, chaque mois. L'offre suit la licence : Boutique 100
   conversations pour 5 000 F par mois (activation 10 000 F), Pro 250 pour 10 000 F (activation 15 000 F), Business
   500 pour 15 000 F (activation 20 000 F) ; recharge de 50 conversations pour 3 000 F. 1 crédit = 1 conversation ; les
   crédits non utilisés sont perdus en fin de mois. Dans l'administration, fiche du commerce → « Assistant Finch » :
   **Activer** (une fois, avec les premiers mois), **Renouveler** (1 à 12 mois, à la suite des mois payés) ou
   **Recharge**, avec le montant réellement reçu ; le dernier paiement saisi s'annule tant que ses crédits n'ont pas
   servi. L'accueil de l'administration liste les abonnements à renouveler et la rentabilité du mois. Pendant l'essai
   gratuit, 10 conversations sont offertes ; les démonstrations restent gratuites (20 par jour). Sans abonnement, le
   micro ouvre une fiche avec un bouton WhatsApp vers Sama Stock. Prix : `src/lib/domain/plans.ts`. Rappels (3 jours
   avant la fin, le jour de la fin) : tâche Vercel `/api/assistant/rappels` à 9 h.
```

- dans « Limites », remplacer `- 60 conversations par commerce et par jour (\`ASSISTANT_DAILY_LIMIT\`) ; 20 dans les boutiques de démonstration.` par `- Crédits de l'abonnement, plus une limite de sécurité de 60 conversations par jour (\`ASSISTANT_DAILY_LIMIT\`) ; 20 par jour dans les boutiques de démonstration.`

- [ ] **Step 3: Vérifier types, lint et toute la suite**

Run: `NODE_OPTIONS=--max-old-space-size=1800 npx tsc --noEmit` puis `npx eslint src/server/demo` puis `npx vitest run`
Expected: aucune erreur ; toute la suite passe.

Run: `grep -rn "assistantEnabled" src --include=*.ts --include=*.tsx`
Expected: seulement `src/db/schema/app.ts` et `src/server/backup/tables.ts` (colonne gardée jusqu'à une prochaine mise à jour).

- [ ] **Step 4: Commit**

```bash
git add src/server/demo LISEZ-MOI.md
git commit -m "docs(assistant): LISEZ-MOI de l'abonnement Finch ; la démo ne lit plus assistant_enabled

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Vérification sur une branche Neon, puis mise en service

**Files:** aucun fichier de code (sauf correction d'un défaut trouvé, avec son propre commit).

- [ ] **Step 1: Créer une branche Neon (copie de la production) pour l'essai**

Avec l'outil Neon (`create_branch`, projet `lucky-term-12839013`, nom `essai-abonnement-finch`), puis `get_connection_string` sur cette branche. Garder l'adresse dans une variable du terminal, jamais dans un fichier du dépôt.

- [ ] **Step 2: Appliquer la migration sur la branche**

Run: `DATABASE_URL="<adresse de la branche>" npx drizzle-kit migrate`
Expected: `0015_assistant_abonnement` appliquée ; les tables `assistant_payments` et `assistant_months` existent sur la branche (vérifier avec `run_sql` sur la branche : `select count(*) from assistant_months`).

- [ ] **Step 3: Lancer l'application sur la branche**

Run (en arrière-plan) : `DATABASE_URL="<adresse de la branche>" npm run dev`
Expected: le serveur répond sur `http://localhost:3000`. Le propriétaire se connecte lui-même dans le navigateur intégré (aucun mot de passe saisi par l'agent).

- [ ] **Step 4: Parcourir le scénario**

1. Administration → un commerce sous licence → « Assistant Finch » : statut « Non activé ».
2. Activer avec 1 mois (Wave, montant pré-rempli 25 000 F pour une Pro) → statut « Actif », 250/250, fin dans 1 mois ; journal admin mis à jour.
3. Renouveler 2 mois → la fin recule de 2 mois (mois à la suite, pas aujourd'hui).
4. Annuler ce dernier renouvellement → la fin revient au mois précédent.
5. Recharge → 300 conversations au total.
6. Côté commerçant (même commerce) : ouvrir Finch → compteur « 299 conversations restantes » en bas du plein écran.
7. Sur la branche, mettre `used = credits + extra_credits` du mois en cours (`run_sql` sur la branche) → toucher le micro : la fiche « Plus de conversations ce mois-ci » s'ouvre avec le bouton WhatsApp.
8. Sans `GEMINI_API_KEY` (relancer `npm run dev` avec `GEMINI_API_KEY=` vide) → la réponse est « pas encore configuré » et `used` ne bouge pas ; avec une clé invalide (`GEMINI_API_KEY=abc`), le crédit est rendu (`used` inchangé après l'essai).
9. Page « Licence » du commerçant : carte Assistant Finch avec paiements, sans nom d'administrateur.
10. Accueil admin : le commerce apparaît dans « à renouveler » si sa fin est à moins de 7 jours (avancer `ends_at` sur la branche) ; la carte Rentabilité montre l'argent encaissé.
11. Rappels : `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/assistant/rappels` (avec la fin à J+2,5) → `{"envoyes":1}` et une notification « se termine bientôt ».

Expected: chaque point se comporte comme décrit ; sinon, corriger, ajouter le test qui manquait, commiter, et reprendre le point.

- [ ] **Step 5: Arrêter le serveur et supprimer la branche Neon**

Arrêter `npm run dev`, puis `delete_branch` sur `essai-abonnement-finch`.

- [ ] **Step 6: Mise en service (chaque étape avec l'accord explicite du propriétaire)**

1. Le propriétaire prévient le commerce sous licence qui a aujourd'hui Finch (il le perd jusqu'à son activation).
2. Appliquer la migration sur la base de production : `npm run db:migrate` (le `.env` pointe sur la production). Vérifier avec `run_sql` (branche principale) que les deux tables existent.
3. Fusionner : `git switch master && git merge --ff-only assistant-abonnement && git push origin master`.
4. Suivre le déploiement Vercel jusqu'à `READY`, puis vérifier sur sama-stock.com : `POST /api/assistant/session` sans connexion répond 401, et la tâche `rappels` apparaît dans les tâches planifiées du projet Vercel.

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
  try {
    await db.transaction((tx) => notify(tx, ctx, messageAssistant(rappel)));
  } catch (e) {
    // L'alerte est un plus : une panne ici ne doit jamais refuser une conversation déjà ouverte.
    console.error("[assistant] alerte crédits", e);
  }
}

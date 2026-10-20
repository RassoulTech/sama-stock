"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { businesses, businessNotes, session, subscriptionEvents, user } from "@/db/schema";
import { computePlanState, PERIOD_DAYS, PLANS } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { ActionError, parse, runAction } from "../action";
import { getSession, requireSuperAdminAction } from "../context";
import { logAdmin } from "../services/admin-audit";
import { grantPeriod } from "../services/subscription";

async function load(id: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, id));
  if (!b) throw new ActionError("Commerce introuvable.");
  return b;
}

const DAY = 86_400_000;
const days = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;

export async function adminSetPlan(businessId: string, input: { plan: string; days: number }) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const data = parse(
      z.object({ plan: z.enum(["trial", "pro", "business"]), days: z.coerce.number().int().min(1).max(366) }),
      input,
    );
    await load(businessId);
    const end = new Date(Date.now() + data.days * DAY);
    await db.transaction(async (tx) => {
      await tx
        .update(businesses)
        .set(data.plan === "trial" ? { plan: "trial", trialEndsAt: end } : { plan: data.plan, periodEndsAt: end })
        .where(eq(businesses.id, businessId));
      await tx.insert(subscriptionEvents).values({
        businessId,
        plan: data.plan,
        amount: 0,
        periodStart: new Date(),
        periodEnd: end,
        method: "admin",
        note: `Modifié par ${ctx.user.email}`,
        userId: ctx.user.id,
      });
      await logAdmin(tx, ctx, {
        action: "plan",
        businessId,
        summary: `Formule ${PLANS[data.plan].label} pour ${days(data.days)}, jusqu'au ${formatDate(end)} (sans paiement)`,
      });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

export async function adminExtend(businessId: string, extra: number) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const d = parse(z.coerce.number().int().min(1).max(366), extra);
    const b = await load(businessId);
    const state = computePlanState(b);
    const base = state.endsAt && state.endsAt > new Date() ? state.endsAt : new Date();
    const end = new Date(base.getTime() + d * DAY);
    await db.transaction(async (tx) => {
      await tx
        .update(businesses)
        .set(state.plan === "trial" ? { trialEndsAt: end } : { periodEndsAt: end })
        .where(eq(businesses.id, businessId));
      await logAdmin(tx, ctx, {
        action: "extend",
        businessId,
        summary: `${state.plan === "trial" ? "Essai" : `Formule ${state.label}`} prolongé(e) de ${days(d)}, jusqu'au ${formatDate(end)}`,
      });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** Fait expirer immédiatement l'essai ou l'abonnement (utile pour tester le mode consultation seule). */
export async function adminExpireNow(businessId: string) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const b = await load(businessId);
    const past = new Date(Date.now() - 60_000);
    await db.transaction(async (tx) => {
      await tx
        .update(businesses)
        .set(b.plan === "trial" ? { trialEndsAt: past } : { periodEndsAt: past })
        .where(eq(businesses.id, businessId));
      await logAdmin(tx, ctx, { action: "expire", businessId, summary: "Essai ou abonnement arrêté immédiatement" });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** Paiement reçu en espèces : active la formule pour N mois et compte l'argent dans les revenus. */
export async function adminRecordCashPayment(businessId: string, input: { plan: string; months: number }) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const data = parse(
      z.object({
        plan: z.enum(["pro", "business"], { message: "Choisissez Pro ou Business." }),
        months: z.coerce.number().int().min(1, "Au moins 1 mois.").max(12, "12 mois maximum."),
      }),
      input,
    );
    await load(businessId);
    const amount = PLANS[data.plan].price * data.months;
    await db.transaction(async (tx) => {
      await grantPeriod(tx, {
        businessId,
        plan: data.plan,
        amount,
        method: "especes",
        userId: ctx.user.id,
        days: PERIOD_DAYS * data.months,
        note: `${data.months} mois · encaissé par ${ctx.user.email}`,
      });
      await logAdmin(tx, ctx, {
        action: "cash",
        businessId,
        summary: `${formatFCFA(amount)} encaissés en espèces : formule ${PLANS[data.plan].label} pour ${data.months} mois`,
      });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** Déconnecte une session précise (appareil perdu, activité suspecte). */
export async function adminRevokeSession(sessionId: string) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const current = await getSession();
    if (current?.session.id === sessionId) {
      throw new ActionError("C'est votre session actuelle : utilisez « Se déconnecter ».");
    }
    const [target] = await db
      .select({ userId: session.userId, email: user.email })
      .from(session)
      .innerJoin(user, eq(user.id, session.userId))
      .where(eq(session.id, sessionId));
    await db.transaction(async (tx) => {
      await tx.delete(session).where(eq(session.id, sessionId));
      if (target) {
        await logAdmin(tx, ctx, { action: "revoke_session", targetUserId: target.userId, summary: `Un appareil de ${target.email} a été déconnecté` });
      }
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** Déconnecte un utilisateur de tous ses appareils. */
export async function adminRevokeUserSessions(userId: string) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    if (ctx.user.id === userId) throw new ActionError("Vous ne pouvez pas vous déconnecter vous-même d'ici.");
    const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
    await db.transaction(async (tx) => {
      await tx.delete(session).where(eq(session.userId, userId));
      await logAdmin(tx, ctx, {
        action: "revoke_user",
        targetUserId: userId,
        summary: `${target?.email ?? "Un utilisateur"} a été déconnecté de tous ses appareils`,
      });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

export async function adminSetSuspended(businessId: string, suspended: boolean) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    await load(businessId);
    await db.transaction(async (tx) => {
      await tx.update(businesses).set({ suspendedAt: suspended ? new Date() : null }).where(eq(businesses.id, businessId));
      await logAdmin(tx, ctx, {
        action: suspended ? "suspend" : "resume",
        businessId,
        summary: suspended ? "Accès au commerce suspendu" : "Accès au commerce rétabli",
      });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** Note interne sur un commerce (appel, promesse de paiement, besoin particulier…). */
export async function adminAddNote(businessId: string, body: string) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const text = parse(
      z.string().trim().min(2, "Écrivez au moins 2 caractères.").max(1000, "1 000 caractères au maximum."),
      body,
    );
    await load(businessId);
    await db.transaction(async (tx) => {
      await tx.insert(businessNotes).values({ businessId, authorId: ctx.user.id, authorName: ctx.user.name || ctx.user.email, body: text });
      await logAdmin(tx, ctx, { action: "note", businessId, summary: `Note ajoutée : « ${text.length > 80 ? `${text.slice(0, 80)}…` : text} »` });
    });
    revalidatePath(`/admin/commerces/${businessId}`);
    return null;
  });
}

export async function adminDeleteNote(noteId: string) {
  return runAction(async () => {
    await requireSuperAdminAction();
    const [note] = await db.select({ businessId: businessNotes.businessId }).from(businessNotes).where(eq(businessNotes.id, noteId));
    if (!note) throw new ActionError("Note introuvable.");
    await db.delete(businessNotes).where(and(eq(businessNotes.id, noteId), eq(businessNotes.businessId, note.businessId)));
    revalidatePath(`/admin/commerces/${note.businessId}`);
    return null;
  });
}

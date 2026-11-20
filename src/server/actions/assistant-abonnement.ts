"use server";

import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { assistantMonths, assistantPayments, businesses } from "@/db/schema";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { libellePaiement, moisDeRecharge, peutAnnuler, planifierMois, type GenrePaiement } from "@/lib/domain/assistant/abonnement";
import { ASSISTANT_OFFERS, ASSISTANT_RECHARGE, ASSISTANT_RENEW_MAX_MONTHS, computePlanState, type LicensePackId } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { ActionError, parse, runAction } from "../action";
import { type AppContext, requireSuperAdminAction } from "../context";
import { moisDuCommerce } from "../queries/assistant";
import { logAdmin } from "../services/admin-audit";

const METHODS = Object.keys(LICENSE_PAYMENT_METHODS) as [LicensePaymentMethod, ...LicensePaymentMethod[]];
const argent = {
  amount: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number({ message: "Indiquez le montant reçu." }).int("Montant en francs entiers.").min(0, "Montant invalide.").max(10_000_000),
  ),
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

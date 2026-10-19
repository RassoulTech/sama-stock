"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { subscriptionCheckouts } from "@/db/schema";
import { PLANS } from "@/lib/domain/plans";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";
import { createCheckoutSession, isPaymentSimulation, isSaspayEnabled } from "../saspay";
import { confirmCheckout, grantPeriod } from "../services/subscription";

const planSchema = z.enum(["pro", "business"], { message: "Formule inconnue." });

/** Paiement simulé : seulement en local tant que SasPay n'est pas configuré, jamais en production. */
export async function simulatePayment(plan: string) {
  return runAction(async () => {
    if (!isPaymentSimulation) throw new ActionError("Le paiement simulé est désactivé.");
    // write: false — un compte expiré doit justement pouvoir payer
    const ctx = await requireActionContext("billing.manage", { write: false });
    const target = parse(planSchema, plan);
    const end = await db.transaction((tx) =>
      grantPeriod(tx, {
        businessId: ctx.business.id,
        plan: target,
        amount: PLANS[target].price,
        method: "simulation",
        userId: ctx.user.id,
      }),
    );
    revalidatePath("/", "layout");
    return { plan: target, periodEndsAt: end };
  });
}

/** Ouvre une page de paiement SasPay (Wave ou Orange Money) et renvoie son adresse. */
export async function startCheckout(plan: string) {
  return runAction(async () => {
    if (!isSaspayEnabled) throw new ActionError("Le paiement en ligne n'est pas encore activé.");
    const ctx = await requireActionContext("billing.manage", { write: false });
    const target = parse(planSchema, plan);
    const amount = PLANS[target].price;
    const checkoutId = crypto.randomUUID();

    const session = await createCheckoutSession({
      amount,
      description: `Sama Stock — formule ${PLANS[target].label} (30 jours)`,
      customerEmail: ctx.user.email,
      customerName: ctx.user.name || ctx.business.name,
      returnUrl: `${process.env.BETTER_AUTH_URL}/abonnement/retour?paiement=${checkoutId}`,
      metadata: { checkoutId, businessId: ctx.business.id, plan: target },
    }).catch((error) => {
      console.error("[saspay]", error);
      throw new ActionError("Le service de paiement ne répond pas. Réessayez dans un instant.");
    });

    await db.insert(subscriptionCheckouts).values({
      id: checkoutId,
      businessId: ctx.business.id,
      plan: target,
      amount,
      sessionId: session.id,
      userId: ctx.user.id,
    });
    return { url: session.checkout_url };
  });
}

/** Revérifie un paiement resté en attente (client qui a fermé la page avant de revenir). */
export async function refreshCheckout(checkoutId: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("billing.manage", { write: false });
    const [row] = await db
      .select({ id: subscriptionCheckouts.id })
      .from(subscriptionCheckouts)
      .where(and(eq(subscriptionCheckouts.id, checkoutId), eq(subscriptionCheckouts.businessId, ctx.business.id)));
    if (!row) throw new ActionError("Paiement introuvable.");

    const outcome = await confirmCheckout(row.id).catch((error) => {
      console.error("[saspay]", error);
      throw new ActionError("Le service de paiement ne répond pas. Réessayez dans un instant.");
    });
    revalidatePath("/", "layout");
    if (outcome === "pending") throw new ActionError("Paiement pas encore confirmé. Réessayez dans un instant.");
    if (outcome === "failed") throw new ActionError("Ce paiement a échoué ou a expiré.");
    return outcome;
  });
}

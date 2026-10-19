"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { businesses, subscriptionEvents } from "@/db/schema";
import { PERIOD_DAYS, PLANS } from "@/lib/domain/plans";
import { parse, runAction } from "../action";
import { requireActionContext } from "../context";

/**
 * MVP : simule le paiement d'un mois d'abonnement.
 * En production, cette action sera déclenchée par la confirmation du prestataire de paiement (Wave, Orange Money…).
 */
export async function simulatePayment(plan: string) {
  return runAction(async () => {
    // write: false — un compte expiré doit justement pouvoir payer
    const ctx = await requireActionContext("billing.manage", { write: false });
    const target = parse(z.enum(["pro", "business"], { message: "Formule inconnue." }), plan);
    const now = new Date();
    // Un renouvellement de la même formule encore active prolonge la période en cours
    const extend = ctx.plan.plan === target && ctx.plan.status === "active" && ctx.business.periodEndsAt;
    const start = extend ? ctx.business.periodEndsAt! : now;
    const end = new Date(start.getTime() + PERIOD_DAYS * 86_400_000);

    await db.transaction(async (tx) => {
      await tx.update(businesses).set({ plan: target, periodEndsAt: end }).where(eq(businesses.id, ctx.business.id));
      await tx.insert(subscriptionEvents).values({
        businessId: ctx.business.id,
        plan: target,
        amount: PLANS[target].price,
        periodStart: start,
        periodEnd: end,
        method: "simulation",
        userId: ctx.user.id,
      });
    });

    revalidatePath("/", "layout");
    return { plan: target, periodEndsAt: end };
  });
}

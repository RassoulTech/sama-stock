"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { businesses, subscriptionEvents } from "@/db/schema";
import { computePlanState } from "@/lib/domain/plans";
import { ActionError, parse, runAction } from "../action";
import { requireSuperAdminAction } from "../context";

async function load(id: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, id));
  if (!b) throw new ActionError("Commerce introuvable.");
  return b;
}

const DAY = 86_400_000;

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
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

export async function adminExtend(businessId: string, days: number) {
  return runAction(async () => {
    await requireSuperAdminAction();
    const d = parse(z.coerce.number().int().min(1).max(366), days);
    const b = await load(businessId);
    const state = computePlanState(b);
    const base = state.endsAt && state.endsAt > new Date() ? state.endsAt : new Date();
    const end = new Date(base.getTime() + d * DAY);
    await db
      .update(businesses)
      .set(state.plan === "trial" ? { trialEndsAt: end } : { periodEndsAt: end })
      .where(eq(businesses.id, businessId));
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** Fait expirer immédiatement l'essai ou l'abonnement (utile pour tester le mode consultation seule). */
export async function adminExpireNow(businessId: string) {
  return runAction(async () => {
    await requireSuperAdminAction();
    const b = await load(businessId);
    const past = new Date(Date.now() - 60_000);
    await db
      .update(businesses)
      .set(b.plan === "trial" ? { trialEndsAt: past } : { periodEndsAt: past })
      .where(eq(businesses.id, businessId));
    revalidatePath("/admin", "layout");
    return null;
  });
}

export async function adminSetSuspended(businessId: string, suspended: boolean) {
  return runAction(async () => {
    await requireSuperAdminAction();
    await load(businessId);
    await db.update(businesses).set({ suspendedAt: suspended ? new Date() : null }).where(eq(businesses.id, businessId));
    revalidatePath("/admin", "layout");
    return null;
  });
}

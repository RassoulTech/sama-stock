"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { appErrors, pushSubscriptions } from "@/db/schema";
import { pushSubscriptionSchema, type PushSubscriptionInput } from "@/lib/push-subscription";
import { parse, runAction } from "../action";
import { requireSuperAdminAction } from "../context";
import { alertAdmins } from "../services/app-errors";

/** Ce téléphone recevra les alertes de panne de l'administrateur, même application fermée. */
export async function saveAdminPushSubscription(input: PushSubscriptionInput) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const sub = parse(pushSubscriptionSchema, input);
    const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
    await db
      .insert(pushSubscriptions)
      .values({ userId: ctx.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: ctx.user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
      });
    return null;
  });
}

export async function removeAdminPushSubscription(endpoint: string) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, ctx.user.id)));
    return null;
  });
}

/** Alerte d'essai : téléphones des administrateurs et e-mail. */
export async function sendAdminTestAlert() {
  return runAction(async () => {
    await requireSuperAdminAction();
    const res = await alertAdmins({ title: "Alertes de panne activées", body: "Vous serez prévenu ici quand Sama Stock a un problème." });
    return { sent: res.phones, mail: res.mail };
  });
}

/** La panne est corrigée ; si elle revient, une nouvelle alerte partira. */
export async function resolveAppError(id: string) {
  return runAction(async () => {
    await requireSuperAdminAction();
    const errorId = parse(z.string().min(1).max(64), id);
    await db.update(appErrors).set({ resolvedAt: new Date() }).where(eq(appErrors.id, errorId));
    revalidatePath("/admin/pannes");
    return null;
  });
}

"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { businesses, members, pushSubscriptions } from "@/db/schema";
import { receivesNotifications } from "@/lib/domain/notifications";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";
import { notificationIcon, sendPush } from "../push";

/** Propriétaire ou gérant du commerce ouvert (les seuls à recevoir les notifications). */
async function notifiedContext() {
  const ctx = await requireActionContext(undefined, { write: false });
  if (!receivesNotifications(ctx.role)) throw new ActionError("Les notifications sont réservées au propriétaire et aux gérants.");
  return ctx;
}

/** La liste vient d'être ouverte : ce qui précède n'est plus « non lu ». */
export async function markNotificationsSeen() {
  return runAction(async () => {
    const ctx = await notifiedContext();
    await db
      .update(members)
      .set({ notificationsSeenAt: new Date() })
      .where(and(eq(members.businessId, ctx.business.id), eq(members.userId, ctx.user.id)));
    return null;
  });
}

const prefsSchema = z.object({ sale: z.boolean(), order: z.boolean(), stock: z.boolean(), sound: z.boolean() });

export async function updateNotifyPrefs(input: z.input<typeof prefsSchema>) {
  return runAction(async () => {
    const ctx = await notifiedContext();
    const prefs = parse(prefsSchema, input);
    await db
      .update(members)
      .set({ notifyPrefs: prefs })
      .where(and(eq(members.businessId, ctx.business.id), eq(members.userId, ctx.user.id)));
    return null;
  });
}

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Ce téléphone recevra les notifications de cette personne, même application fermée. */
export async function savePushSubscription(input: z.input<typeof subscriptionSchema>) {
  return runAction(async () => {
    const ctx = await notifiedContext();
    const sub = parse(subscriptionSchema, input);
    const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
    // Un même téléphone repris par quelqu'un d'autre : l'abonnement change de propriétaire
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

export async function removePushSubscription(endpoint: string) {
  return runAction(async () => {
    const ctx = await requireActionContext(undefined, { write: false });
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, ctx.user.id)));
    return null;
  });
}

/** Notification d'essai sur les téléphones de la personne. */
export async function sendTestNotification() {
  return runAction(async () => {
    const ctx = await notifiedContext();
    const targets = await db
      .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, ctx.user.id));
    const [shop] = await db.select({ slug: businesses.slug, licensePack: businesses.licensePack }).from(businesses).where(eq(businesses.id, ctx.business.id));
    const sent = await sendPush(targets, {
      id: crypto.randomUUID(),
      kind: "sale",
      title: "Notifications activées",
      body: `Vous serez prévenu ici des ventes, des commandes et du stock de ${ctx.business.name}.`,
      url: "/mon-compte",
      icon: notificationIcon({ slug: shop?.slug ?? null, licensed: Boolean(shop?.licensePack) }),
      tag: "test",
    });
    return { sent };
  });
}

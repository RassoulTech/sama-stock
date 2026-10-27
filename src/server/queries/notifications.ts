import "server-only";
import { and, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, notifications } from "@/db/schema";
import { NOTIFY_KINDS, notifiesActor, notifyPrefs, receivesNotifications, TOPIC_OF, type NotifyPrefs } from "@/lib/domain/notifications";
import type { BusinessContext } from "../context";

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
}

export interface NotificationFeed {
  enabled: boolean;
  items: NotificationItem[];
  unread: number;
  prefs: NotifyPrefs;
}

/** Réglages et dernière lecture de la personne dans ce commerce. */
export async function memberNotifySettings(ctx: BusinessContext) {
  const [m] = await db
    .select({ prefs: members.notifyPrefs, seenAt: members.notificationsSeenAt, createdAt: members.createdAt })
    .from(members)
    .where(and(eq(members.businessId, ctx.business.id), eq(members.userId, ctx.user.id)));
  return { prefs: notifyPrefs(m?.prefs), seenAt: m?.seenAt ?? m?.createdAt ?? new Date() };
}

/** Dernières notifications du commerce pour le propriétaire ou un gérant (selon ses réglages). */
export async function listNotifications(ctx: BusinessContext, limit = 30): Promise<NotificationFeed> {
  const { prefs, seenAt } = await memberNotifySettings(ctx);
  if (!receivesNotifications(ctx.role)) return { enabled: false, items: [], unread: 0, prefs };
  const kinds = NOTIFY_KINDS.filter((k) => prefs[TOPIC_OF[k]]);
  if (kinds.length === 0) return { enabled: true, items: [], unread: 0, prefs };
  const forMe = and(
    eq(notifications.businessId, ctx.business.id),
    inArray(notifications.kind, kinds),
    // Ses propres ventes et commandes ne le concernent pas ; les alertes de stock, si
    or(...(kinds.some(notifiesActor) ? [inArray(notifications.kind, kinds.filter(notifiesActor))] : []), isNull(notifications.actorId), ne(notifications.actorId, ctx.user.id)),
  );
  const [items, [count]] = await Promise.all([
    db
      .select({ id: notifications.id, kind: notifications.kind, title: notifications.title, body: notifications.body, href: notifications.href, createdAt: notifications.createdAt })
      .from(notifications)
      .where(forMe)
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(forMe, gt(notifications.createdAt, seenAt))),
  ]);
  return {
    enabled: true,
    items: items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })),
    unread: count?.n ?? 0,
    prefs,
  };
}

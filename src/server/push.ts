import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { businesses, notifications, pushSubscriptions } from "@/db/schema";
import { isNotifyKind, NOTIFIED_ROLES, notifiesActor, notifyPrefs, TOPIC_OF } from "@/lib/domain/notifications";
import { LEGAL } from "@/lib/legal";

/** Clé publique donnée au téléphone pour s'abonner ; null tant que les clés ne sont pas configurées. */
export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function configured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${LEGAL.email}`, publicKey, privateKey);
  return true;
}

export interface PushPayload {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  icon: string;
  tag: string;
}

type Target = { id: string; endpoint: string; p256dh: string; auth: string };

/** Envoie à des téléphones ; les abonnements expirés (le téléphone s'est désabonné) sont retirés. */
export async function sendPush(targets: Target[], payload: PushPayload, urgency: "normal" | "high" = "normal"): Promise<number> {
  if (!configured() || targets.length === 0) return 0;
  const body = JSON.stringify(payload);
  const sent: string[] = [];
  const gone: string[] = [];
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body, { TTL: 86_400, urgency });
        sent.push(t.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(t.id);
        else console.error("[notifications] envoi impossible", status ?? error);
      }
    }),
  );
  if (gone.length > 0) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  if (sent.length > 0) await db.update(pushSubscriptions).set({ lastSuccessAt: new Date() }).where(inArray(pushSubscriptions.id, sent));
  return sent.length;
}

/** Icône de la notification : celle de l'application de la boutique (licence), sinon celle de Sama Stock. */
export function notificationIcon(shop: { slug: string | null; licensed: boolean }): string {
  return shop.licensed && shop.slug ? `/b/${shop.slug}/icone/192` : "/icon-192.png";
}

/** Envoie une notification enregistrée aux téléphones du propriétaire et des gérants (sauf à son auteur). */
export async function deliverPush(notificationId: string): Promise<void> {
  try {
    if (!configured()) return;
    const [n] = await db
      .select({
        id: notifications.id,
        businessId: notifications.businessId,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        actorId: notifications.actorId,
        slug: businesses.slug,
        licensed: sql<boolean>`${businesses.licensePack} is not null`,
        isDemo: businesses.isDemo,
      })
      .from(notifications)
      .innerJoin(businesses, eq(businesses.id, notifications.businessId))
      .where(eq(notifications.id, notificationId));
    // La démonstration publique est partagée par tout le monde : rien ne part sur les téléphones
    if (!n || n.isDemo || !isNotifyKind(n.kind)) return;
    const topic = TOPIC_OF[n.kind];
    const rows = await db.execute<Target & { notify_prefs: unknown }>(sql`
      select ps.id, ps.endpoint, ps.p256dh, ps.auth, m.notify_prefs
      from members m join push_subscriptions ps on ps.user_id = m.user_id
      where m.business_id = ${n.businessId}
        and m.role in (${sql.join(NOTIFIED_ROLES.map((r) => sql`${r}`), sql`, `)})
        and (${notifiesActor(n.kind)} or m.user_id is distinct from ${n.actorId})`);
    const targets = rows.rows.filter((r) => notifyPrefs(r.notify_prefs)[topic]);
    await sendPush(
      targets,
      {
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        url: n.href ?? "/tableau-de-bord",
        icon: notificationIcon(n),
        tag: `${n.kind}-${n.id}`,
      },
      n.kind === "stock_out" ? "high" : "normal",
    );
    // Les notifications de plus de 90 jours ne servent plus
    await db
      .delete(notifications)
      .where(and(eq(notifications.businessId, n.businessId), sql`${notifications.createdAt} < now() - interval '90 days'`));
  } catch (error) {
    console.error("[notifications]", error);
  }
}

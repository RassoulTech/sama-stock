import "server-only";
import { createHash } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { appErrors, pushSubscriptions, user } from "@/db/schema";
import { alertText, describeError, errorDigest, errorKey, isFrameworkSignal, normalizeRoute, shouldAlert, type ErrorSource } from "@/lib/domain/app-errors";
import { LEGAL } from "@/lib/legal";
import { ActionError } from "../action";
import { adminEmails } from "../admin-emails";
import { alertEmail, isMailEnabled, sendMail } from "../mail";
import { sendPush } from "../push";

export interface ErrorReport {
  source: ErrorSource;
  route: string;
  message: string;
  digest?: string | null;
}

/** En ligne seulement ; l'ordinateur de développement partage la base de production (sauf ERRORS_DEV=1 pour les essais). */
function recording(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.ERRORS_DEV === "1";
}

const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "https://sama-stock-one.vercel.app").replace(/\/$/, "");

/** Base injoignable : e-mail seul, au plus un par panne et par heure sur ce serveur. */
const mailedWithoutDb = new Map<string, number>();
/** Pannes envoyées par les navigateurs (adresse publique) : au plus une alerte toutes les 5 minutes par serveur. */
let lastBrowserAlert = 0;

/** Enregistre une panne et prévient l'administrateur si besoin. Ne lève jamais d'erreur. */
export async function reportError(report: ErrorReport): Promise<void> {
  const message = (report.message || "Erreur sans message").slice(0, 500);
  const route = normalizeRoute(report.route || "/");
  console.error("[panne]", report.source, route, message);
  if (!recording()) return;
  const fingerprint = createHash("sha1").update(errorKey(report.source, route, message)).digest("hex");
  const now = new Date();
  let alertCount: number | null;
  try {
    alertCount = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(appErrors)
        .values({ fingerprint, source: report.source, route, message, digest: report.digest ?? null, alertedAt: now })
        .onConflictDoNothing({ target: appErrors.fingerprint })
        .returning({ id: appErrors.id });
      if (inserted.length > 0) return 1;
      const [previous] = await tx.select().from(appErrors).where(eq(appErrors.fingerprint, fingerprint)).for("update");
      if (!previous) return null;
      const notify = shouldAlert({ lastSeenAt: previous.lastSeenAt, resolvedAt: previous.resolvedAt }, now);
      const count = previous.count + 1;
      await tx
        .update(appErrors)
        .set({ count, message, digest: report.digest ?? previous.digest, lastSeenAt: now, resolvedAt: null, ...(notify ? { alertedAt: now } : {}) })
        .where(eq(appErrors.id, previous.id));
      return notify ? count : null;
    });
  } catch (dbError) {
    console.error("[panne] base injoignable", dbError);
    const last = mailedWithoutDb.get(fingerprint) ?? 0;
    if (now.getTime() - last < 3_600_000) return;
    mailedWithoutDb.set(fingerprint, now.getTime());
    await mailAdmin(alertText({ source: report.source, route, message, count: 1 }));
    return;
  }
  if (alertCount === null) return;
  if (report.source === "navigateur") {
    if (now.getTime() - lastBrowserAlert < 5 * 60_000) return;
    lastBrowserAlert = now.getTime();
  }
  await alertAdmins(alertText({ source: report.source, route, message, count: alertCount }));
}

/** Panne vue par Next.js (page, route, action non attrapée). */
export async function reportServerError(error: unknown, path: string): Promise<void> {
  const digest = errorDigest(error);
  if (isFrameworkSignal(digest) || error instanceof ActionError) return;
  await reportError({ source: "serveur", route: path, message: describeError(error), digest });
}

/** Page d'où vient une action (en-tête Referer). */
export async function currentRoute(): Promise<string> {
  try {
    const referer = (await headers()).get("referer");
    return referer ? new URL(referer).pathname : "/";
  } catch {
    return "/";
  }
}

/** Téléphones des super admins (ADMIN_EMAILS). */
export async function adminPushTargets() {
  const emails = adminEmails();
  if (emails.length === 0) return [];
  return db
    .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
    .from(pushSubscriptions)
    .innerJoin(user, eq(user.id, pushSubscriptions.userId))
    .where(inArray(sql`lower(${user.email})`, emails));
}

async function mailAdmin(text: { title: string; body: string }, path = "/admin/pannes"): Promise<boolean> {
  if (!isMailEnabled) return false;
  try {
    await sendMail({ to: LEGAL.email, ...alertEmail({ ...text, url: `${siteUrl()}${path}` }) });
    return true;
  } catch (error) {
    console.error("[panne] e-mail impossible", error);
    return false;
  }
}

/** Prévient les super admins : notification sur leurs téléphones et e-mail. Ne lève jamais d'erreur. */
export async function alertAdmins(text: { title: string; body: string }, path = "/admin/pannes"): Promise<{ phones: number; mail: boolean }> {
  let phones = 0;
  try {
    phones = await sendPush(
      await adminPushTargets(),
      { id: crypto.randomUUID(), kind: "panne", title: text.title, body: text.body, url: path, icon: "/icon-192.png", tag: `panne-${Date.now()}` },
      "high",
    );
  } catch (error) {
    console.error("[panne] notification impossible", error);
  }
  const mail = await mailAdmin(text, path);
  return { phones, mail };
}

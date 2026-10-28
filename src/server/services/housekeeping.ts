import "server-only";
import { and, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { appErrors, notifications, rateLimit, session, verification } from "@/db/schema";

const DAY = 86_400_000;

/**
 * Ménage de la nuit : ce qui ne sert plus à personne quitte la base (elle ne grossit que de vraies données).
 * Connexions expirées, liens expirés, compteurs anti-essais de la veille, notifications et pannes réglées de 90 jours.
 */
export async function nightlyCleanup(now = new Date()): Promise<Record<string, number>> {
  const old = new Date(now.getTime() - 90 * DAY);
  const counts: Record<string, number> = {};
  const run = async (name: string, query: Promise<{ rowCount: number | null }>) => {
    counts[name] = (await query).rowCount ?? 0;
  };
  await run("sessions", db.delete(session).where(lt(session.expiresAt, now)));
  await run("liens", db.delete(verification).where(lt(verification.expiresAt, now)));
  await run("antiEssais", db.delete(rateLimit).where(lt(rateLimit.lastRequest, now.getTime() - DAY)));
  await run("notifications", db.delete(notifications).where(lt(notifications.createdAt, old)));
  await run("pannes", db.delete(appErrors).where(and(isNotNull(appErrors.resolvedAt), lt(appErrors.resolvedAt, old))));
  return counts;
}

/**
 * Place utilisée, mesurée comme Neon (toutes les bases du serveur, y compris celles du système),
 * et les plus grosses tables de Sama Stock (octets, lignes).
 */
export async function databaseUsage() {
  const [{ bytes }] = (await db.execute(sql`select sum(pg_database_size(datname))::bigint as bytes from pg_database`)).rows as { bytes: string }[];
  const tables = (
    await db.execute(sql`
      select relname as name, pg_total_relation_size(relid)::bigint as bytes, n_live_tup::bigint as rows
      from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 10`)
  ).rows as { name: string; bytes: string; rows: string }[];
  return { bytes: Number(bytes), tables: tables.map((t) => ({ name: t.name, bytes: Number(t.bytes), rows: Number(t.rows) })) };
}

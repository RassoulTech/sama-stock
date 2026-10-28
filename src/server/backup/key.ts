import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Clé des tâches automatiques (Vercel la met dans « Authorization: Bearer … », GitHub aussi). */
export function isBackupKeyValid(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

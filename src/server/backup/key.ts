import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Valeur collée à la main dans Vercel : espaces, retours à la ligne ou guillemets autour sont ignorés. */
function cleanSecret(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

/** Clé des tâches automatiques (Vercel la met dans « Authorization: Bearer … », GitHub aussi). */
export function isBackupKeyValid(request: Request): boolean {
  const secret = cleanSecret(process.env.CRON_SECRET);
  if (secret.length < 32) return false;
  const header = (request.headers.get("authorization") ?? "").trim();
  const given = Buffer.from(header.startsWith("Bearer ") ? cleanSecret(header.slice(7)) : "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

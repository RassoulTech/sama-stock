import "server-only";
import { count, desc, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { appErrors } from "@/db/schema";

/** Pannes non réglées d'abord, puis les plus récentes. */
export async function listAppErrors(limit = 200) {
  return db
    .select()
    .from(appErrors)
    .orderBy(sql`${appErrors.resolvedAt} is null desc`, desc(appErrors.lastSeenAt))
    .limit(limit);
}

export async function openAppErrorCount(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(appErrors).where(isNull(appErrors.resolvedAt));
  return row?.n ?? 0;
}

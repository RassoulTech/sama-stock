import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantUsage } from "@/db/schema";
import { assistantDailyLimit } from "@/lib/domain/assistant/limits";

/** Compte une demande (incrément atomique) et dit si la limite du jour est respectée (plus basse pour une démo). */
export async function consumeAssistantQuota(
  businessId: string,
  opts: { isDemo?: boolean; now?: Date } = {},
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const day = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const [row] = await db
    .insert(assistantUsage)
    .values({ businessId, day, count: 1 })
    .onConflictDoUpdate({
      target: [assistantUsage.businessId, assistantUsage.day],
      set: { count: sql`${assistantUsage.count} + 1` },
    })
    .returning({ count: assistantUsage.count });
  const limit = assistantDailyLimit(process.env.ASSISTANT_DAILY_LIMIT, opts.isDemo ?? false);
  return { allowed: row.count <= limit, count: row.count, limit };
}

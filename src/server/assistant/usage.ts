import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantUsage } from "@/db/schema";

export const DEFAULT_DAILY_LIMIT = 60;

/** Demandes permises par commerce et par jour (ASSISTANT_DAILY_LIMIT, sinon 60). */
export function dailyLimit(): number {
  const value = Number(process.env.ASSISTANT_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
}

/** Compte une demande (incrément atomique) et dit si la limite du jour est respectée. */
export async function consumeAssistantQuota(
  businessId: string,
  now = new Date(),
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const day = now.toISOString().slice(0, 10);
  const [row] = await db
    .insert(assistantUsage)
    .values({ businessId, day, count: 1 })
    .onConflictDoUpdate({
      target: [assistantUsage.businessId, assistantUsage.day],
      set: { count: sql`${assistantUsage.count} + 1` },
    })
    .returning({ count: assistantUsage.count });
  const limit = dailyLimit();
  return { allowed: row.count <= limit, count: row.count, limit };
}

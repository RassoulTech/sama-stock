import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistantMonths } from "@/db/schema";
import type { MoisAssistant } from "@/lib/domain/assistant/abonnement";

export type MoisEnBase = MoisAssistant & { paymentId: string | null };

/** Fenêtres de crédits d'un commerce, de la plus ancienne à la plus récente. */
export async function moisDuCommerce(businessId: string): Promise<MoisEnBase[]> {
  const rows = await db
    .select({
      id: assistantMonths.id,
      kind: assistantMonths.kind,
      startsAt: assistantMonths.startsAt,
      endsAt: assistantMonths.endsAt,
      credits: assistantMonths.credits,
      extraCredits: assistantMonths.extraCredits,
      used: assistantMonths.used,
      paymentId: assistantMonths.paymentId,
    })
    .from(assistantMonths)
    .where(eq(assistantMonths.businessId, businessId))
    .orderBy(asc(assistantMonths.startsAt));
  return rows.map((r) => ({ ...r, kind: r.kind === "essai" ? "essai" : "abonnement" }));
}

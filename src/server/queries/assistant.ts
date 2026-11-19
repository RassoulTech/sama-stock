import "server-only";
import { asc, eq, sql } from "drizzle-orm";
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

/** Fin du dernier mois d'abonnement de chaque commerce (hors démonstrations). */
export async function finsAbonnement(): Promise<{ businessId: string; finLe: Date }[]> {
  const res = await db.execute<{ business_id: string; ends_at: string | Date }>(sql`
    select distinct on (m.business_id) m.business_id, m.ends_at
    from assistant_months m join businesses b on b.id = m.business_id
    where m.kind = 'abonnement' and not b.is_demo
    order by m.business_id, m.ends_at desc`);
  return res.rows.map((r) => ({ businessId: r.business_id, finLe: new Date(r.ends_at) }));
}

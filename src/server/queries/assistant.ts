import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantMonths, assistantPayments, user } from "@/db/schema";
import { peutAnnuler, type GenrePaiement, type MoisAssistant } from "@/lib/domain/assistant/abonnement";

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

export interface PaiementAssistantVue {
  id: string;
  kind: GenrePaiement;
  months: number;
  credits: number;
  amount: number;
  method: string;
  note: string | null;
  paidAt: Date;
  /** Administrateur qui l'a saisi (jamais montré au commerçant). */
  recordedBy: string | null;
  /** Dernier paiement saisi, dont les crédits n'ont pas servi. */
  annulable: boolean;
}

const genre = (k: string): GenrePaiement => (k === "activation" || k === "recharge" ? k : "mois");

/** Le mois d'abonnement qui portait une recharge (celui qui couvrait sa date de paiement). */
export function moisDeRecharge(mois: readonly MoisAssistant[], paidAt: Date): MoisAssistant | null {
  return mois.find((m) => m.kind === "abonnement" && m.startsAt <= paidAt && m.endsAt > paidAt) ?? null;
}

/** Paiements de Finch d'un commerce, du plus récent au plus ancien. */
export async function paiementsDuCommerce(businessId: string): Promise<PaiementAssistantVue[]> {
  const [rows, mois] = await Promise.all([
    db
      .select({
        id: assistantPayments.id,
        kind: assistantPayments.kind,
        months: assistantPayments.months,
        credits: assistantPayments.credits,
        amount: assistantPayments.amount,
        method: assistantPayments.method,
        note: assistantPayments.note,
        paidAt: assistantPayments.paidAt,
        recordedBy: user.name,
      })
      .from(assistantPayments)
      .leftJoin(user, eq(user.id, assistantPayments.recordedBy))
      .where(eq(assistantPayments.businessId, businessId))
      .orderBy(desc(assistantPayments.createdAt)),
    moisDuCommerce(businessId),
  ]);
  return rows.map((p, i) => {
    const kind = genre(p.kind);
    const crees = mois.filter((m) => m.paymentId === p.id);
    const cible = kind === "recharge" ? moisDeRecharge(mois, p.paidAt) : null;
    return { ...p, kind, annulable: i === 0 && peutAnnuler({ kind, credits: p.credits }, crees, cible) };
  });
}

import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { assistantMonths, assistantPayments, assistantUsage, businesses, user } from "@/db/schema";
import { moisDeRecharge, peutAnnuler, rentabilite, type GenrePaiement, type MoisAssistant, type Rentabilite } from "@/lib/domain/assistant/abonnement";

export type MoisEnBase = MoisAssistant & { paymentId: string | null };

/** Fenêtres de crédits d'un commerce, de la plus ancienne à la plus récente (dans `exec` : la transaction qui écrit). */
export async function moisDuCommerce(businessId: string, exec: DbOrTx = db): Promise<MoisEnBase[]> {
  const rows = await exec
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

export interface ARenouveler {
  businessId: string;
  name: string;
  phone: string | null;
  finLe: Date;
  used: number;
  total: number;
}

/** Abonnements qui finissent dans les 7 jours sans mois payé ensuite, ou expirés depuis moins de 30 jours. */
export async function aRenouveler(): Promise<ARenouveler[]> {
  const res = await db.execute<{ business_id: string; name: string; phone: string | null; ends_at: string | Date; used: number; total: number }>(sql`
    select * from (
      select distinct on (m.business_id) m.business_id, b.name, b.phone, m.ends_at, m.used, m.credits + m.extra_credits as total
      from assistant_months m join businesses b on b.id = m.business_id
      where m.kind = 'abonnement' and not b.is_demo
      order by m.business_id, m.ends_at desc
    ) d
    where d.ends_at < now() + interval '7 days' and d.ends_at > now() - interval '30 days'
    order by d.ends_at asc`);
  return res.rows.map((r) => ({ businessId: r.business_id, name: r.name, phone: r.phone, finLe: new Date(r.ends_at), used: Number(r.used), total: Number(r.total) }));
}

/** Argent encaissé pour Finch et conversations du mois en cours (calendrier, Dakar = UTC), hors démonstrations. */
export async function rentabiliteDuMois(now = new Date()): Promise<Rentabilite> {
  const debut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [[encaisse], [conversations]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${assistantPayments.amount}), 0)` })
      .from(assistantPayments)
      .innerJoin(businesses, eq(businesses.id, assistantPayments.businessId))
      .where(and(gte(assistantPayments.paidAt, debut), eq(businesses.isDemo, false))),
    db
      .select({ total: sql<number>`coalesce(sum(${assistantUsage.count}), 0)` })
      .from(assistantUsage)
      .innerJoin(businesses, eq(businesses.id, assistantUsage.businessId))
      .where(and(gte(assistantUsage.day, debut.toISOString().slice(0, 10)), eq(businesses.isDemo, false))),
  ]);
  return rentabilite(Number(encaisse?.total ?? 0), Number(conversations?.total ?? 0));
}

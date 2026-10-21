import "server-only";
import { sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";

export type LicenseSaleRow = {
  id: string;
  number: string;
  pack: string;
  list_price: number;
  agreed_price: number;
  maintenance_price: number;
  status: string;
  note: string | null;
  created_at: Date;
  cancelled_at: Date | null;
  business_id: string;
  business: string;
  city: string | null;
  phone: string | null;
  logo: string | null;
  brand_color: string | null;
  activated_at: Date | null;
  maintenance_ends_at: Date | null;
  owner_name: string | null;
  owner_email: string | null;
  paid_licence: number;
  paid_maintenance: number;
  last_payment: Date | null;
};

const SALES = sql`
  select s.id, s.number, s.pack, s.list_price, s.agreed_price, s.maintenance_price, s.status, s.note, s.created_at, s.cancelled_at,
    b.id as business_id, b.name as business, b.city, b.phone, b.logo, b.brand_color,
    b.license_activated_at as activated_at, b.maintenance_ends_at,
    u.name as owner_name, u.email as owner_email,
    coalesce((select sum(p.amount) from license_payments p where p.sale_id = s.id and p.kind = 'licence'), 0)::int as paid_licence,
    coalesce((select sum(p.amount) from license_payments p where p.sale_id = s.id and p.kind = 'maintenance'), 0)::int as paid_maintenance,
    (select max(p.paid_at) from license_payments p where p.sale_id = s.id) as last_payment
  from license_sales s
  join businesses b on b.id = s.business_id
  left join "user" u on u.id = b.owner_id
  where not b.is_demo`;

/** Toutes les ventes de licences, les plus récentes d'abord (mises en cache pour la requête). */
export const listLicenseSales = cache(async () => {
  const res = await db.execute<LicenseSaleRow>(sql`${SALES} order by s.created_at desc`);
  return res.rows;
});

export async function getLicenseSale(id: string) {
  const res = await db.execute<LicenseSaleRow>(sql`${SALES} and s.id = ${id}`);
  const sale = res.rows[0];
  if (!sale) return null;
  const payments = await db.execute<{
    id: string;
    kind: string;
    amount: number;
    method: string;
    note: string | null;
    paid_at: Date;
    recorded_by: string | null;
  }>(sql`
    select p.id, p.kind, p.amount, p.method, p.note, p.paid_at, u.email as recorded_by
    from license_payments p left join "user" u on u.id = p.recorded_by
    where p.sale_id = ${id} order by p.paid_at`);
  return { sale, payments: payments.rows };
}

/** Vente active d'un commerce (ou null). */
export async function activeSaleFor(businessId: string) {
  const res = await db.execute<LicenseSaleRow>(sql`${SALES} and s.business_id = ${businessId} and s.status = 'active' order by s.created_at desc limit 1`);
  return res.rows[0] ?? null;
}

const DAY = 86_400_000;
export const balanceOf = (s: LicenseSaleRow) => Math.max(0, s.agreed_price - s.paid_licence);

/** Chiffres clés et listes à traiter pour les licences. */
export function licenseSummary(sales: LicenseSaleRow[], now = Date.now()) {
  const active = sales.filter((s) => s.status === "active");
  const ends = (s: LicenseSaleRow) => (s.maintenance_ends_at ? new Date(s.maintenance_ends_at).getTime() : 0);
  const activatedDaysAgo = (s: LicenseSaleRow) => (s.activated_at ? Math.floor((now - new Date(s.activated_at).getTime()) / DAY) : -1);
  return {
    count: active.length,
    sold: active.reduce((t, s) => t + s.agreed_price, 0),
    collected: active.reduce((t, s) => t + s.paid_licence + s.paid_maintenance, 0),
    due: active.reduce((t, s) => t + balanceOf(s), 0),
    /** Licences pas encore entièrement payées. */
    toCollect: active.filter((s) => balanceOf(s) > 0),
    /** Maintenance qui se termine dans les 30 jours. */
    maintenanceSoon: active.filter((s) => ends(s) > now && ends(s) - now <= 30 * DAY),
    /** Maintenance terminée (pas renouvelée). */
    maintenanceOver: active.filter((s) => ends(s) > 0 && ends(s) <= now),
    /** Appels de suivi : 3 jours et 30 jours après l'installation. */
    followUps: active.filter((s) => [3, 4, 30, 31].includes(activatedDaysAgo(s))),
  };
}

/** Argent reçu pour les licences et la maintenance : ce mois-ci et le mois dernier. */
export async function licenseRevenue() {
  const res = await db.execute<{ month: number; prev: number }>(sql`
    select
      coalesce(sum(amount) filter (where paid_at >= date_trunc('month', now())), 0)::int as month,
      coalesce(sum(amount) filter (where paid_at >= date_trunc('month', now()) - interval '1 month' and paid_at < date_trunc('month', now())), 0)::int as prev
    from license_payments p join license_sales s on s.id = p.sale_id where s.status = 'active'`);
  return res.rows[0] ?? { month: 0, prev: 0 };
}

import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { businesses, businessNotes, subscriptionEvents, user } from "@/db/schema";
import { businessHealth } from "@/lib/domain/admin";
import { computePlanState, PLANS, type PlanStatus } from "@/lib/domain/plans";

/** Ventes comptées : ventes validées en caisse et commandes livrées. */
const DONE = sql`((s.kind = 'sale' and s.status = 'completed') or (s.kind = 'order' and s.status = 'delivered'))`;

/** Tous les commerces (hors démo), mis en cache pour la durée de la requête (menu + page). */
export const listAllBusinesses = cache(async () => {
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      activity: businesses.activity,
      phone: businesses.phone,
      city: businesses.city,
      plan: businesses.plan,
      trialEndsAt: businesses.trialEndsAt,
      periodEndsAt: businesses.periodEndsAt,
      suspendedAt: businesses.suspendedAt,
      createdAt: businesses.createdAt,
      ownerId: businesses.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      productCount: sql<number>`(select count(*)::int from products p where p.business_id = ${businesses.id} and p.archived_at is null)`,
      memberCount: sql<number>`(select count(*)::int from members m where m.business_id = ${businesses.id})`,
      locationCount: sql<number>`(select count(*)::int from locations l where l.business_id = ${businesses.id})`,
      saleCount: sql<number>`(select count(*)::int from sales s where s.business_id = ${businesses.id} and ${DONE})`,
      sales30: sql<number>`(select count(*)::int from sales s where s.business_id = ${businesses.id} and ${DONE} and s.completed_at > now() - interval '30 days')`,
      revenue30: sql<number>`(select coalesce(sum(s.subtotal - s.discount), 0)::int from sales s where s.business_id = ${businesses.id} and ${DONE} and s.completed_at > now() - interval '30 days')`,
      lastActivity: sql<string | null>`greatest(
        (select max(s.created_at) from sales s where s.business_id = ${businesses.id}),
        (select max(m.created_at) from stock_movements m where m.business_id = ${businesses.id})
      )`,
      paidTotal: sql<number>`(select coalesce(sum(e.amount), 0)::int from subscription_events e where e.business_id = ${businesses.id} and e.method in ('saspay', 'especes'))`,
    })
    .from(businesses)
    .leftJoin(user, eq(businesses.ownerId, user.id))
    // Les boutiques de la démo publique ne sont pas des clients
    .where(eq(businesses.isDemo, false))
    .orderBy(desc(businesses.createdAt));

  return rows.map((r) => {
    const lastActivity = r.lastActivity ? new Date(r.lastActivity) : null;
    return {
      ...r,
      productCount: Number(r.productCount),
      revenue30: Number(r.revenue30),
      paidTotal: Number(r.paidTotal),
      lastActivity,
      health: businessHealth(lastActivity),
      state: computePlanState(r),
    };
  });
});

/** Compteurs du menu : commerces, échéances à traiter, paiements en attente. */
export async function adminNavBadges() {
  const [rows, pending] = await Promise.all([
    listAllBusinesses(),
    db.execute<{ n: number }>(sql`select count(*)::int as n from subscription_checkouts where status = 'pending' and created_at > now() - interval '48 hours'`),
  ]);
  const todo = todoLists(rows);
  const due = todo.trialsEnding.length + todo.renewalsEnding.length + todo.recentlyExpired.length;
  const waiting = pending.rows[0]?.n ?? 0;
  return {
    "/admin/commerces": { value: rows.length, tone: "muted" as const },
    ...(due > 0 ? { "/admin/abonnements": { value: due, tone: "alert" as const } } : {}),
    ...(waiting > 0 ? { "/admin/paiements": { value: waiting, tone: "alert" as const } } : {}),
  };
}

export type AdminBusinessRow = Awaited<ReturnType<typeof listAllBusinesses>>[number];

export function adminStats(rows: AdminBusinessRow[]) {
  const by = (s: PlanStatus) => rows.filter((r) => r.state.status === s).length;
  const paying = rows.filter((r) => r.state.status === "active" && r.state.plan !== "trial");
  return {
    total: rows.length,
    trialing: by("trialing"),
    active: paying.length,
    expired: by("expired"),
    suspended: by("suspended"),
    mrr: paying.reduce((s, r) => s + PLANS[r.state.plan].price, 0),
    /** Commerces avec une vente ou un mouvement de stock ces 7 derniers jours. */
    alive7: rows.filter((r) => r.health === "active").length,
  };
}

/** Parcours d'un commerce : inscrit → premier produit → première vente → client payant. */
export function activationFunnel(rows: AdminBusinessRow[]) {
  return [
    { key: "signup", label: "Inscrits", count: rows.length },
    { key: "product", label: "Ont ajouté un produit", count: rows.filter((r) => r.productCount > 0).length },
    { key: "sale", label: "Ont fait une vente", count: rows.filter((r) => r.saleCount > 0).length },
    { key: "paid", label: "Sont devenus payants", count: rows.filter((r) => r.paidTotal > 0).length },
  ];
}

/** Essais et abonnements en cours qui se terminent dans les `days` prochains jours, du plus proche au plus lointain. */
export function endingSoon(rows: AdminBusinessRow[], days: number) {
  const limit = Date.now() + days * 86_400_000;
  return rows
    .filter((r) => (r.state.status === "active" || r.state.status === "trialing") && r.state.endsAt && r.state.endsAt.getTime() <= limit)
    .sort((a, b) => a.state.endsAt!.getTime() - b.state.endsAt!.getTime());
}

/** Ce qui demande une action de l'équipe aujourd'hui. */
export function todoLists(rows: AdminBusinessRow[]) {
  const now = Date.now();
  const DAY = 86_400_000;
  return {
    trialsEnding: endingSoon(rows, 3).filter((r) => r.state.status === "trialing"),
    renewalsEnding: endingSoon(rows, 5).filter((r) => r.state.status === "active"),
    recentlyExpired: rows.filter((r) => r.state.status === "expired" && r.state.endsAt && now - r.state.endsAt.getTime() <= 30 * DAY),
    notStarted: rows.filter((r) => r.productCount === 0 && now - r.createdAt.getTime() >= 2 * DAY && r.state.status !== "suspended"),
    goneQuiet: rows.filter((r) => r.health === "inactive" && r.state.status !== "suspended"),
  };
}

/** Méthodes de paiement d'abonnement, telles qu'affichées à l'administrateur. */
export const SUBSCRIPTION_METHOD_LABELS: Record<string, string> = {
  saspay: "Wave / Orange Money",
  especes: "Espèces",
  admin: "Ajustement manuel",
  simulation: "Simulation (test)",
};

/** Comptes de la démo publique (exclus des statistiques et des listes). */
export const DEMO_EMAIL_DOMAIN = "@sama-stock.invalid";
const REAL_USER = sql`email not like ${"%" + DEMO_EMAIL_DOMAIN}`;
const REAL_BUSINESS = sql`business_id not in (select id from businesses where is_demo)`;

/** Seuls les vrais encaissements comptent dans les revenus (ni simulation, ni ajustement). */
const REAL_PAYMENT = sql`method in ('saspay', 'especes')`;

export async function platformOverview() {
  const [counts, signups, revenue] = await Promise.all([
    db.execute<{
      users: number;
      orphan_users: number;
      products: number;
      sales30: number;
      gmv30: number;
      active_sessions: number;
      active_users7: number;
      revenue_month: number;
      revenue_prev: number;
      signups_month: number;
      signups_prev: number;
      pending_checkouts: number;
      google_users: number;
    }>(sql`select
      (select count(*)::int from "user" where ${REAL_USER}) as users,
      (select count(*)::int from "user" u where ${REAL_USER} and not exists (select 1 from members m where m.user_id = u.id)) as orphan_users,
      (select count(*)::int from products where archived_at is null and ${REAL_BUSINESS}) as products,
      (select count(*)::int from sales s where ${DONE} and s.completed_at > now() - interval '30 days' and ${REAL_BUSINESS}) as sales30,
      (select coalesce(sum(s.subtotal - s.discount), 0)::bigint::float8 from sales s where ${DONE} and s.completed_at > now() - interval '30 days' and ${REAL_BUSINESS}) as gmv30,
      (select count(*)::int from session where expires_at > now()
        and user_id in (select id from "user" where ${REAL_USER})) as active_sessions,
      (select count(distinct user_id)::int from session where updated_at > now() - interval '7 days'
        and user_id in (select id from "user" where ${REAL_USER})) as active_users7,
      (select coalesce(sum(amount), 0)::int from subscription_events
        where ${REAL_PAYMENT} and created_at >= date_trunc('month', now())) as revenue_month,
      (select coalesce(sum(amount), 0)::int from subscription_events
        where ${REAL_PAYMENT} and created_at >= date_trunc('month', now()) - interval '1 month'
        and created_at < date_trunc('month', now())) as revenue_prev,
      (select count(*)::int from businesses where not is_demo and created_at >= date_trunc('month', now())) as signups_month,
      (select count(*)::int from businesses where not is_demo and created_at >= date_trunc('month', now()) - interval '1 month'
        and created_at < date_trunc('month', now())) as signups_prev,
      (select count(*)::int from subscription_checkouts
        where status = 'pending' and created_at > now() - interval '48 hours') as pending_checkouts,
      (select count(distinct user_id)::int from account where provider_id = 'google') as google_users`),
    db.execute<{ day: string; n: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day, count(b.id)::int as n
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
      left join businesses b on date_trunc('day', b.created_at) = d and not b.is_demo
      group by d order by d`),
    db.execute<{ month: string; total: number }>(sql`
      select to_char(m, 'YYYY-MM') as month, coalesce(sum(e.amount), 0)::int as total
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
      left join subscription_events e on date_trunc('month', e.created_at) = m and e.method in ('saspay', 'especes')
      group by m order by m`),
  ]);
  const c = counts.rows[0]!;
  return { counts: { ...c, gmv30: Number(c.gmv30) }, signups: signups.rows, revenue: revenue.rows };
}

export async function listAllUsers() {
  const res = await db.execute<{
    id: string;
    name: string;
    email: string;
    email_verified: boolean;
    created_at: Date;
    providers: string[] | null;
    last_seen: Date | null;
    active_sessions: number;
    memberships: { businessId: string; business: string; role: string }[] | null;
  }>(sql`
    select u.id, u.name, u.email, u.email_verified, u.created_at,
      (select array_agg(distinct a.provider_id) from account a where a.user_id = u.id) as providers,
      (select max(coalesce(s.updated_at, s.created_at)) from session s where s.user_id = u.id) as last_seen,
      (select count(*)::int from session s where s.user_id = u.id and s.expires_at > now()) as active_sessions,
      (select json_agg(json_build_object('businessId', b.id, 'business', b.name, 'role', m.role) order by m.created_at)
        from members m join businesses b on b.id = m.business_id where m.user_id = u.id) as memberships
    from "user" u
    where u.email not like ${"%" + DEMO_EMAIL_DOMAIN}
    order by u.created_at desc`);
  return res.rows;
}

export async function listSessions() {
  const res = await db.execute<{
    id: string;
    created_at: Date;
    last_seen: Date;
    expires_at: Date;
    ip_address: string | null;
    user_agent: string | null;
    user_id: string;
    name: string;
    email: string;
  }>(sql`
    select s.id, s.created_at, coalesce(s.updated_at, s.created_at) as last_seen, s.expires_at,
      s.ip_address, s.user_agent, u.id as user_id, u.name, u.email
    from session s join "user" u on u.id = s.user_id
    where s.expires_at > now()
    order by coalesce(s.updated_at, s.created_at) desc
    limit 300`);
  return res.rows;
}

export async function listPayments() {
  const [events, checkouts, totals] = await Promise.all([
    db.execute<{
      id: string;
      created_at: Date;
      plan: string;
      amount: number;
      method: string;
      note: string | null;
      period_end: Date | null;
      business_id: string;
      business: string;
    }>(sql`
      select e.id, e.created_at, e.plan, e.amount, e.method, e.note, e.period_end, b.id as business_id, b.name as business
      from subscription_events e join businesses b on b.id = e.business_id
      where not b.is_demo
      order by e.created_at desc limit 500`),
    db.execute<{
      id: string;
      created_at: Date;
      plan: string;
      amount: number;
      status: string;
      paid_at: Date | null;
      business_id: string;
      business: string;
    }>(sql`
      select c.id, c.created_at, c.plan, c.amount, c.status, c.paid_at, b.id as business_id, b.name as business
      from subscription_checkouts c join businesses b on b.id = c.business_id
      where not b.is_demo
      order by c.created_at desc limit 100`),
    db.execute<{ method: string; month: number; total: number; count: number }>(sql`
      select method,
        coalesce(sum(amount) filter (where created_at >= date_trunc('month', now())), 0)::int as month,
        coalesce(sum(amount), 0)::int as total,
        count(*)::int as count
      from subscription_events where ${REAL_PAYMENT}
      group by method`),
  ]);
  return { events: events.rows, checkouts: checkouts.rows, totals: totals.rows };
}

export async function getBusinessForAdmin(id: string) {
  const rows = await listAllBusinesses();
  const business = rows.find((r) => r.id === id);
  if (!business) return null;
  const [history, members, notes, audit, locations, daily] = await Promise.all([
    db.select().from(subscriptionEvents).where(eq(subscriptionEvents.businessId, id)).orderBy(desc(subscriptionEvents.createdAt)).limit(30),
    db.execute<{ id: string; name: string; email: string; role: string; last_seen: Date | null }>(sql`
      select u.id, u.name, u.email, m.role,
        (select max(coalesce(s.updated_at, s.created_at)) from session s where s.user_id = u.id) as last_seen
      from members m join "user" u on u.id = m.user_id
      where m.business_id = ${id} order by m.created_at`),
    db.select().from(businessNotes).where(eq(businessNotes.businessId, id)).orderBy(desc(businessNotes.createdAt)).limit(50),
    listAudit({ businessId: id, limit: 30 }),
    db.execute<{ name: string }>(sql`select name from locations where business_id = ${id} order by created_at`),
    db.execute<{ day: string; n: number; total: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day, count(s.id)::int as n, coalesce(sum(s.subtotal - s.discount), 0)::int as total
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
      left join sales s on s.business_id = ${id} and ${DONE} and date_trunc('day', s.completed_at) = d
      group by d order by d`),
  ]);
  return { business, history, members: members.rows, notes, audit, locations: locations.rows.map((l) => l.name), daily: daily.rows };
}

/** Journal des actions des administrateurs (le plus récent d'abord). */
export async function listAudit(opts: { businessId?: string; limit?: number } = {}) {
  const res = await db.execute<{
    id: string;
    created_at: Date;
    actor_email: string;
    action: string;
    summary: string;
    business_id: string | null;
    business: string | null;
    target_email: string | null;
  }>(sql`
    select a.id, a.created_at, a.actor_email, a.action, a.summary, a.business_id, b.name as business,
      (select u.email from "user" u where u.id = a.target_user_id) as target_email
    from admin_audit_log a left join businesses b on b.id = a.business_id
    ${opts.businessId ? sql`where a.business_id = ${opts.businessId}` : sql``}
    order by a.created_at desc
    limit ${opts.limit ?? 300}`);
  return res.rows;
}

/** Index léger pour la recherche rapide (Ctrl K) de l'administration. */
export async function adminSearchIndex() {
  const [biz, users] = await Promise.all([
    db.execute<{ id: string; name: string; city: string | null; owner: string | null; email: string | null }>(sql`
      select b.id, b.name, b.city, u.name as owner, u.email
      from businesses b left join "user" u on u.id = b.owner_id
      where not b.is_demo order by b.created_at desc limit 1000`),
    db.execute<{ id: string; name: string; email: string }>(sql`
      select id, name, email from "user" where ${REAL_USER} order by created_at desc limit 1000`),
  ]);
  return { businesses: biz.rows, users: users.rows };
}

export type AdminSearchIndex = Awaited<ReturnType<typeof adminSearchIndex>>;

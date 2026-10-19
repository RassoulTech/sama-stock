import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, subscriptionEvents, user } from "@/db/schema";
import { computePlanState, PLANS, type PlanStatus } from "@/lib/domain/plans";

export async function listAllBusinesses() {
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
      ownerName: user.name,
      ownerEmail: user.email,
      productCount: sql<number>`(select count(*)::int from products p where p.business_id = ${businesses.id} and p.archived_at is null)`,
      memberCount: sql<number>`(select count(*)::int from members m where m.business_id = ${businesses.id})`,
      sales30: sql<number>`(select count(*)::int from sales s where s.business_id = ${businesses.id} and s.created_at > now() - interval '30 days')`,
      lastActivity: sql<Date | null>`(select max(s.created_at) from sales s where s.business_id = ${businesses.id})`,
    })
    .from(businesses)
    .leftJoin(user, eq(businesses.ownerId, user.id))
    .orderBy(desc(businesses.createdAt));

  return rows.map((r) => ({ ...r, state: computePlanState(r) }));
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
  };
}

export async function getBusinessForAdmin(id: string) {
  const rows = await listAllBusinesses();
  const business = rows.find((r) => r.id === id);
  if (!business) return null;
  const history = await db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.businessId, id))
    .orderBy(desc(subscriptionEvents.createdAt))
    .limit(30);
  const members = await db.execute<{ name: string; email: string; role: string }>(sql`
    select u.name, u.email, m.role from members m join "user" u on u.id = m.user_id
    where m.business_id = ${id} order by m.created_at
  `);
  return { business, history, members: members.rows };
}

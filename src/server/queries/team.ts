import "server-only";
import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { invitations, members, user } from "@/db/schema";

/** Employés (hors propriétaire) + invitations en attente encore valides : ce qui compte dans la limite de la formule. */
export async function employeeCount(businessId: string): Promise<number> {
  const [m] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(members)
    .where(and(eq(members.businessId, businessId), ne(members.role, "owner")));
  const [i] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invitations)
    .where(and(eq(invitations.businessId, businessId), eq(invitations.status, "pending"), gt(invitations.expiresAt, new Date())));
  return Number(m?.n ?? 0) + Number(i?.n ?? 0);
}

export async function listTeam(businessId: string) {
  const team = await db
    .select({
      id: members.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: members.role,
      createdAt: members.createdAt,
      hasPin: sql<boolean>`${members.pinHash} is not null`,
      pinLockedUntil: members.pinLockedUntil,
    })
    .from(members)
    .innerJoin(user, eq(members.userId, user.id))
    .where(eq(members.businessId, businessId))
    .orderBy(asc(members.createdAt));

  const pending = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.businessId, businessId), eq(invitations.status, "pending")))
    .orderBy(desc(invitations.createdAt));

  return { team, pending };
}

import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { businesses, locations, members } from "@/db/schema";
import { auth } from "@/lib/auth";
import { can, isRole, type Permission, type Role } from "@/lib/domain/permissions";
import { computePlanState, type PlanState } from "@/lib/domain/plans";
import { ActionError } from "./action";

export const BUSINESS_COOKIE = "ss_biz";
export const LOCATION_COOKIE = "ss_loc";

export type Business = typeof businesses.$inferSelect;
export type Location = typeof locations.$inferSelect;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Membership {
  businessId: string;
  businessName: string;
  role: Role;
}

interface BaseContext {
  user: SessionUser;
  isSuperAdmin: boolean;
  memberships: Membership[];
}

export interface BusinessContext extends BaseContext {
  business: Business;
  role: Role;
  locations: Location[];
  location: Location;
  plan: PlanState;
  can: (permission: Permission) => boolean;
}

export type AppContext = BaseContext & ({ business: null } | Omit<BusinessContext, keyof BaseContext>);

export function isSuperAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export const getContext = cache(async (): Promise<AppContext | null> => {
  const session = await getSession();
  if (!session) return null;

  const user: SessionUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };

  const rows = await db
    .select({ member: members, business: businesses })
    .from(members)
    .innerJoin(businesses, eq(members.businessId, businesses.id))
    .where(eq(members.userId, user.id))
    .orderBy(asc(members.createdAt));

  const base: BaseContext = {
    user,
    isSuperAdmin: isSuperAdminEmail(user.email),
    memberships: rows
      .filter((r) => isRole(r.member.role))
      .map((r) => ({ businessId: r.business.id, businessName: r.business.name, role: r.member.role as Role })),
  };

  const jar = await cookies();
  const wanted = jar.get(BUSINESS_COOKIE)?.value;
  const current = rows.find((r) => r.business.id === wanted) ?? rows[0];
  if (!current || !isRole(current.member.role)) return { ...base, business: null };

  const locs = await db
    .select()
    .from(locations)
    .where(eq(locations.businessId, current.business.id))
    .orderBy(asc(locations.createdAt));
  const wantedLoc = jar.get(LOCATION_COOKIE)?.value;
  const location = locs.find((l) => l.id === wantedLoc) ?? locs[0];
  if (!location) return { ...base, business: null };

  const role = current.member.role;
  return {
    ...base,
    business: current.business,
    role,
    locations: locs,
    location,
    plan: computePlanState(current.business),
    can: (permission: Permission) => can(role, permission),
  };
});

/** Pour les pages : redirige si l'utilisateur n'a pas accès. */
export async function requireContext(permission?: Permission): Promise<BusinessContext> {
  const ctx = await getContext();
  if (!ctx) redirect("/connexion");
  if (!ctx.business) redirect("/demarrage");
  const bctx = ctx as BusinessContext;
  if (bctx.plan.status === "suspended") redirect("/suspendu");
  if (permission && !bctx.can(permission)) redirect("/tableau-de-bord");
  return bctx;
}

/** Pour les Server Actions : lève une ActionError lisible si l'action est refusée. */
export async function requireActionContext(
  permission?: Permission,
  options: { write?: boolean } = {},
): Promise<BusinessContext> {
  const { write = true } = options;
  const ctx = await getContext();
  if (!ctx) throw new ActionError("Votre session a expiré. Reconnectez-vous.");
  if (!ctx.business) throw new ActionError("Aucun commerce sélectionné.");
  const bctx = ctx as BusinessContext;
  if (bctx.plan.status === "suspended") throw new ActionError("Ce commerce est suspendu. Contactez Sama Stock.");
  if (permission && !bctx.can(permission)) throw new ActionError("Vous n'avez pas les droits pour faire cela.");
  if (write && bctx.plan.readOnly) {
    throw new ActionError(
      "Votre abonnement a expiré : le compte est en consultation seule. Choisissez une formule pour continuer.",
    );
  }
  return bctx;
}

/** Bloque les actions sensibles dans les boutiques de démonstration (paiement, équipe, réglages). */
export function assertNotDemo(ctx: { business: Business | null } | null, what = "Cette action") {
  if (ctx?.business?.isDemo) {
    throw new ActionError(`${what} est désactivée dans la démo. Créez votre compte gratuit pour l'utiliser.`);
  }
}

export async function requireSuperAdmin(): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) redirect("/connexion?redirect=/admin");
  if (!ctx.isSuperAdmin) redirect("/tableau-de-bord");
  return ctx;
}

export async function requireSuperAdminAction(): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx?.isSuperAdmin) throw new ActionError("Réservé aux administrateurs.");
  return ctx;
}

/**
 * Contexte d'un commerce précis, et non celui choisi par le cookie : sert aux ventes faites hors ligne, envoyées
 * plus tard (l'utilisateur a pu changer de commerce entre-temps).
 */
export async function contextForBusiness(user: SessionUser, businessId: string, locationId: string): Promise<BusinessContext | null> {
  const [row] = await db
    .select({ member: members, business: businesses })
    .from(members)
    .innerJoin(businesses, eq(members.businessId, businesses.id))
    .where(and(eq(members.userId, user.id), eq(members.businessId, businessId)));
  if (!row || !isRole(row.member.role)) return null;

  const locs = await db.select().from(locations).where(eq(locations.businessId, businessId)).orderBy(asc(locations.createdAt));
  const location = locs.find((l) => l.id === locationId);
  if (!location) return null;

  const role = row.member.role;
  return {
    user,
    isSuperAdmin: isSuperAdminEmail(user.email),
    memberships: [],
    business: row.business,
    role,
    locations: locs,
    location,
    plan: computePlanState(row.business),
    can: (permission: Permission) => can(role, permission),
  };
}

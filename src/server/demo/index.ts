import "server-only";
import { createHmac } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { account, businesses, user } from "@/db/schema";
import { dayStart } from "@/lib/filters";
import type { PlanId } from "@/lib/domain/plans";
import { seedDemoBusiness, type Tx } from "./seed";
import { DEMO_DATA_SINCE, DEMO_SPECS, type DemoSpec } from "./specs";

export const DEMO_PLANS = ["trial", "pro", "business"] as const satisfies readonly PlanId[];
export type DemoPlan = (typeof DEMO_PLANS)[number];

export function isDemoPlan(value: unknown): value is DemoPlan {
  return typeof value === "string" && (DEMO_PLANS as readonly string[]).includes(value);
}

/**
 * Mot de passe interne d'un compte de démonstration, dérivé du secret du serveur :
 * personne ne le connaît ni ne le saisit, la connexion se fait par le bouton « Entrer dans la démo ».
 */
export function demoPassword(plan: DemoPlan): string {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "sama-stock")
    .update(`sama-stock-demo:${plan}`)
    .digest("base64url")
    .slice(0, 32);
}

const teamEmail = (spec: DemoSpec, key: string) => spec.owner.email.replace("@", `-${key}@`);

async function ensureUser(tx: Tx, name: string, email: string, password?: string): Promise<string> {
  const [existing] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tx.insert(user).values({ id, name, email, emailVerified: true });
  if (password) {
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(password),
      updatedAt: new Date(),
    });
  }
  return id;
}

/**
 * Prépare la boutique de démonstration d'une licence et renvoie l'e-mail du compte à connecter.
 * Les données sont recréées une fois par jour (à la première visite du jour, heure de Dakar).
 */
export async function ensureDemo(plan: DemoPlan): Promise<{ email: string; businessId: string }> {
  const spec = DEMO_SPECS[plan];
  return db.transaction(async (tx) => {
    // Un seul visiteur à la fois prépare la même démo
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`sama-stock-demo:${plan}`}))`);

    const ownerId = await ensureUser(tx, spec.owner.name, spec.owner.email, demoPassword(plan));
    const today = dayStart(new Date());
    const validSince = today > DEMO_DATA_SINCE ? today : DEMO_DATA_SINCE;
    const [fresh] = await tx
      .select({ id: businesses.id })
      .from(businesses)
      // Une démo d'avant les licences (sans licence) est recréée
      .where(and(eq(businesses.ownerId, ownerId), eq(businesses.isDemo, true), gte(businesses.demoResetAt, validSince), isNotNull(businesses.licensePack)));
    if (fresh) return { email: spec.owner.email, businessId: fresh.id };

    // Remise à zéro : tout ce que les visiteurs ont modifié disparaît (suppression en cascade)
    await tx.delete(businesses).where(eq(businesses.ownerId, ownerId));
    const teamIds: Record<string, string> = {};
    for (const m of spec.team) teamIds[m.key] = await ensureUser(tx, m.name, teamEmail(spec, m.key));
    const businessId = await seedDemoBusiness(tx, spec, ownerId, teamIds);
    return { email: spec.owner.email, businessId };
  });
}

/** Réaligne le mot de passe interne (utile si le secret du serveur a changé). */
export async function resetDemoPassword(plan: DemoPlan) {
  const spec = DEMO_SPECS[plan];
  const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, spec.owner.email));
  if (!owner) return;
  await db
    .update(account)
    .set({ password: await hashPassword(demoPassword(plan)) })
    .where(and(eq(account.userId, owner.id), eq(account.providerId, "credential")));
}

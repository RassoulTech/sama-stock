"use server";

import { and, eq, gt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { invitations, members, user } from "@/db/schema";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/lib/domain/permissions";
import { canAdd } from "@/lib/domain/plans";
import { ActionError, parse, runAction } from "../action";
import { BUSINESS_COOKIE, getContext, LOCATION_COOKIE, requireActionContext } from "../context";
import { employeeCount } from "../queries/team";

const INVITATION_DAYS = 7;

async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom de l'employé.").max(80),
  email: z.email("Adresse email invalide.").trim().toLowerCase(),
  role: z.enum(INVITABLE_ROLES, { message: "Choisissez un rôle." }),
});

export async function inviteMember(input: z.input<typeof inviteSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage");
    const data = parse(inviteSchema, input);

    const [existingMember] = await db
      .select({ id: members.id })
      .from(members)
      .innerJoin(user, eq(members.userId, user.id))
      .where(and(eq(members.businessId, ctx.business.id), eq(user.email, data.email)));
    if (existingMember) throw new ActionError("Cette personne fait déjà partie de votre équipe.");

    const [pending] = await db
      .select({ id: invitations.id, token: invitations.token })
      .from(invitations)
      .where(
        and(
          eq(invitations.businessId, ctx.business.id),
          eq(invitations.email, data.email),
          eq(invitations.status, "pending"),
          gt(invitations.expiresAt, new Date()),
        ),
      );

    const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86_400_000);
    let token: string;
    if (pending) {
      token = pending.token;
      await db.update(invitations).set({ name: data.name, role: data.role, expiresAt }).where(eq(invitations.id, pending.id));
    } else {
      const max = ctx.plan.limits.maxEmployees;
      if (!canAdd(max, await employeeCount(ctx.business.id))) {
        throw new ActionError(
          max === 0
            ? "L'essai gratuit ne permet pas d'inviter d'employés. Passez à la formule Pro (3 employés) ou Business (illimité)."
            : `Votre formule ${ctx.plan.label} permet ${max} employés au maximum. Passez à Business pour une équipe illimitée.`,
        );
      }
      token = crypto.randomUUID().replaceAll("-", "");
      await db.insert(invitations).values({
        businessId: ctx.business.id,
        token,
        name: data.name,
        email: data.email,
        role: data.role,
        expiresAt,
        invitedById: ctx.user.id,
      });
    }

    revalidatePath("/equipe");
    return { link: `${await appOrigin()}/invitation/${token}`, roleLabel: ROLE_LABELS[data.role], name: data.name };
  });
}

export async function cancelInvitation(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage");
    await db
      .update(invitations)
      .set({ status: "cancelled" })
      .where(and(eq(invitations.id, id), eq(invitations.businessId, ctx.business.id), eq(invitations.status, "pending")));
    revalidatePath("/equipe");
    return null;
  });
}

export async function invitationLink(token: string) {
  return runAction(async () => {
    await requireActionContext("team.manage", { write: false });
    return `${await appOrigin()}/invitation/${token}`;
  });
}

export async function changeMemberRole(memberId: string, role: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage");
    const newRole = parse(z.enum(INVITABLE_ROLES, { message: "Rôle invalide." }), role);
    const updated = await db
      .update(members)
      .set({ role: newRole })
      .where(and(eq(members.id, memberId), eq(members.businessId, ctx.business.id), ne(members.role, "owner")))
      .returning({ id: members.id });
    if (updated.length === 0) throw new ActionError("Impossible de modifier ce membre.");
    revalidatePath("/equipe");
    return null;
  });
}

export async function removeMember(memberId: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage", { write: false });
    const removed = await db
      .delete(members)
      .where(and(eq(members.id, memberId), eq(members.businessId, ctx.business.id), ne(members.role, "owner")))
      .returning({ id: members.id });
    if (removed.length === 0) throw new ActionError("Impossible de retirer ce membre.");
    revalidatePath("/equipe");
    return null;
  });
}

export async function acceptInvitation(token: string) {
  return runAction(async () => {
    const ctx = await getContext();
    if (!ctx) throw new ActionError("Connectez-vous d'abord.");

    const businessId = await db.transaction(async (tx) => {
      const [inv] = await tx.select().from(invitations).where(eq(invitations.token, token)).for("update");
      if (!inv || inv.status !== "pending") throw new ActionError("Cette invitation n'est plus valide.");
      if (inv.expiresAt < new Date()) throw new ActionError("Cette invitation a expiré. Demandez un nouveau lien.");
      if (inv.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
        throw new ActionError(`Cette invitation est destinée à ${inv.email}. Connectez-vous avec ce compte.`);
      }
      await tx
        .insert(members)
        .values({ businessId: inv.businessId, userId: ctx.user.id, role: inv.role })
        .onConflictDoNothing();
      await tx.update(invitations).set({ status: "accepted", acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
      return inv.businessId;
    });

    const jar = await cookies();
    jar.set(BUSINESS_COOKIE, businessId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    jar.delete(LOCATION_COOKIE);
    revalidatePath("/", "layout");
    return null;
  });
}

"use server";

import { and, eq, gt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { invitations, members, session, user } from "@/db/schema";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/lib/domain/permissions";
import { canAdd } from "@/lib/domain/plans";
import { generatePin, isStaffEmail, isValidPin, isWeakPin, staffEmail } from "@/lib/domain/staff-pin";
import { hashPassword } from "better-auth/crypto";
import { ActionError, parse, runAction } from "../action";
import { assertNotDemo, BUSINESS_COOKIE, getContext, isSuperAdminEmail, LOCATION_COOKIE, requireActionContext } from "../context";
import { employeeCount } from "../queries/team";
import { ensureBusinessSlug } from "../services/business-slug";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { DEVICE_INVITE_MINUTES, signDeviceInvite } from "@/lib/domain/device-invite";
import { SHOP_COOKIE } from "@/lib/shop-app";
import { createDevice, DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, readDevice, revokeDevice, SHOP_COOKIE_OPTIONS } from "../services/devices";
import { setCredentialPassword, temporaryPassword } from "../services/passwords";

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
    assertNotDemo(ctx, "La gestion de l'équipe");
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
    assertNotDemo(ctx, "La gestion de l'équipe");
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
    assertNotDemo(await requireActionContext("team.manage", { write: false }), "L'invitation");
    return `${await appOrigin()}/invitation/${token}`;
  });
}

export async function changeMemberRole(memberId: string, role: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage");
    assertNotDemo(ctx, "La gestion de l'équipe");
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

/**
 * Mot de passe oublié par un employé : le propriétaire lui en crée un provisoire (sans e-mail).
 * Refusé si la personne a d'autres commerces sur Sama Stock : elle passe alors par « Mot de passe oublié ».
 */
export async function resetMemberPassword(memberId: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage", { write: false });
    assertNotDemo(ctx, "La gestion de l'équipe");
    const [target] = await db
      .select({ userId: members.userId, role: members.role, name: user.name, email: user.email })
      .from(members)
      .innerJoin(user, eq(user.id, members.userId))
      .where(and(eq(members.id, memberId), eq(members.businessId, ctx.business.id)));
    if (!target || target.role === "owner") throw new ActionError("Impossible de changer le mot de passe de ce membre.");
    if (target.userId === ctx.user.id) throw new ActionError("Pour votre propre compte, utilisez « Mon mot de passe ».");
    if (isStaffEmail(target.email)) throw new ActionError("Cet employé se connecte avec son code PIN : changez plutôt son code.");
    const [other] = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, target.userId), ne(members.businessId, ctx.business.id)));
    if (other || isSuperAdminEmail(target.email)) {
      throw new ActionError(`${target.name} utilise aussi Sama Stock ailleurs : il doit passer par « Mot de passe oublié » sur la page de connexion.`);
    }
    const password = temporaryPassword();
    await db.transaction((tx) => setCredentialPassword(tx, target.userId, password, { signOutEverywhere: true }));
    return { name: target.name, email: target.email, password };
  });
}

export async function removeMember(memberId: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage", { write: false });
    assertNotDemo(ctx, "La gestion de l'équipe");
    const removed = await db
      .delete(members)
      .where(and(eq(members.id, memberId), eq(members.businessId, ctx.business.id), ne(members.role, "owner")))
      .returning({ id: members.id, userId: members.userId });
    if (removed.length === 0) throw new ActionError("Impossible de retirer ce membre.");
    // Employé sans e-mail : il n'a pas d'autre commerce, ses sessions ouvertes sont fermées
    const [gone] = await db.select({ email: user.email }).from(user).where(eq(user.id, removed[0]!.userId));
    if (gone && isStaffEmail(gone.email)) await db.delete(session).where(eq(session.userId, removed[0]!.userId));
    revalidatePath("/equipe");
    return null;
  });
}

export async function acceptInvitation(token: string) {
  return runAction(async () => {
    const ctx = await getContext();
    if (!ctx) throw new ActionError("Connectez-vous d'abord.");
    assertNotDemo(ctx, "Rejoindre une équipe");

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

const employeeSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom de l'employé.").max(80),
  role: z.enum(INVITABLE_ROLES, { message: "Choisissez un rôle." }),
  // Facultatif : pour qu'il puisse aussi se connecter depuis son propre téléphone, avec un mot de passe
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .optional()
    .default("")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Adresse e-mail invalide."),
});

/**
 * Ajoute un employé sans e-mail ni invitation : un code PIN à 4 chiffres lui est créé (affiché une seule fois).
 * Avec un e-mail facultatif, il reçoit aussi un mot de passe provisoire pour se connecter de partout.
 */
export async function addEmployee(input: z.input<typeof employeeSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage");
    assertNotDemo(ctx, "La gestion de l'équipe");
    const data = parse(employeeSchema, input);
    const max = ctx.plan.limits.maxEmployees;
    if (max === 0) throw new ActionError("Votre formule ne comprend pas d'employés.");
    if (!canAdd(max, await employeeCount(ctx.business.id))) throw new ActionError(`Limite de ${max} employés atteinte.`);

    const pin = generatePin();
    const pinHash = await hashPassword(pin);
    const result = await db.transaction(async (tx) => {
      let userId: string;
      let password: string | null = null;
      if (data.email) {
        const [existing] = await tx.select({ id: user.id }).from(user).where(eq(user.email, data.email));
        if (existing) {
          const [already] = await tx
            .select({ id: members.id })
            .from(members)
            .where(and(eq(members.userId, existing.id), eq(members.businessId, ctx.business.id)));
          if (already) throw new ActionError("Cette personne fait déjà partie de votre équipe.");
          // Compte Sama Stock existant : il garde son mot de passe
          userId = existing.id;
        } else {
          userId = crypto.randomUUID();
          await tx.insert(user).values({ id: userId, name: data.name, email: data.email, emailVerified: true });
          password = temporaryPassword();
          await setCredentialPassword(tx, userId, password);
        }
      } else {
        userId = crypto.randomUUID();
        await tx.insert(user).values({ id: userId, name: data.name, email: staffEmail(userId), emailVerified: true });
      }
      await tx.insert(members).values({ businessId: ctx.business.id, userId, role: data.role, pinHash, pinSetAt: new Date() });
      return { password };
    });

    revalidatePath("/equipe");
    return { name: data.name, roleLabel: ROLE_LABELS[data.role], pin, email: data.email || null, password: result.password };
  });
}

/** Nouveau code PIN pour un membre (le propriétaire peut aussi se donner le sien). Débloque aussi le compte. */
export async function resetMemberPin(memberId: string, chosen?: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage", { write: false });
    assertNotDemo(ctx, "La gestion de l'équipe");
    const pin = chosen?.trim() || generatePin();
    if (!isValidPin(pin)) throw new ActionError("Le code doit avoir exactement 4 chiffres.");
    if (isWeakPin(pin)) throw new ActionError("Code trop facile à deviner (1234, 0000…) : choisissez-en un autre.");
    const [target] = await db
      .select({ id: members.id, name: user.name })
      .from(members)
      .innerJoin(user, eq(user.id, members.userId))
      .where(and(eq(members.id, memberId), eq(members.businessId, ctx.business.id)));
    if (!target) throw new ActionError("Membre introuvable.");
    await db
      .update(members)
      .set({ pinHash: await hashPassword(pin), pinFailures: 0, pinLockedUntil: null, pinSetAt: new Date() })
      .where(eq(members.id, target.id));
    revalidatePath("/equipe");
    return { name: target.name, pin };
  });
}

/** Active ce téléphone ou cette tablette pour la boutique : les employés pourront y taper leur code. */
export async function activateThisDevice(name: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage", { write: false });
    assertNotDemo(ctx, "La gestion de l'équipe");
    const label = parse(z.string().trim().min(2, "Donnez un nom à cet appareil (ex. : Tablette caisse).").max(60), name);
    const slug = await ensureBusinessSlug(db, ctx.business.id);
    const { cookie } = await createDevice({ businessId: ctx.business.id, name: label, createdBy: ctx.user.id });
    const jar = await cookies();
    jar.set(DEVICE_COOKIE, cookie, DEVICE_COOKIE_OPTIONS);
    if (slug) jar.set(SHOP_COOKIE, slug, SHOP_COOKIE_OPTIONS);
    revalidatePath("/equipe");
    return { slug };
  });
}

/**
 * QR code pour activer un autre appareil (téléphone d'un employé, tablette) sans s'y connecter :
 * valable 15 minutes (DEVICE_INVITE_MINUTES), pour un seul appareil.
 */
export async function createDeviceInvite() {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage", { write: false });
    assertNotDemo(ctx, "La gestion de l'équipe");
    const slug = await ensureBusinessSlug(db, ctx.business.id);
    if (!slug) throw new ActionError("Commerce introuvable.");
    const expiresAt = new Date(Date.now() + DEVICE_INVITE_MINUTES * 60_000);
    const token = signDeviceInvite(process.env.BETTER_AUTH_SECRET ?? "", {
      businessId: ctx.business.id,
      userId: ctx.user.id,
      expiresAt,
      nonce: randomBytes(12).toString("base64url"),
    });
    const url = `${await appOrigin()}/b/${slug}/activer/${token}`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" });
    return { url, qr, expiresAt: expiresAt.toISOString() };
  });
}

/** Retire un appareil (perdu, vendu, employé parti) : on ne peut plus y taper de code. */
export async function revokeShopDevice(deviceId: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("team.manage", { write: false });
    assertNotDemo(ctx, "La gestion de l'équipe");
    if (!(await revokeDevice(ctx.business.id, deviceId))) throw new ActionError("Appareil introuvable.");
    const current = await readDevice();
    if (current?.id === deviceId) (await cookies()).delete(DEVICE_COOKIE);
    revalidatePath("/equipe");
    return null;
  });
}

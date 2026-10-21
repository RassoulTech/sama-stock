"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { businesses, locations, members } from "@/db/schema";
import { normalizePhone } from "@/lib/format";
import { BRAND_COLORS, type BrandColor } from "@/lib/domain/brand";
import { canAdd, TRIAL_DAYS } from "@/lib/domain/plans";
import { ACTIVITIES, defaultModules, type Activity } from "@/lib/domain/sales";
import { ActionError, parse, runAction } from "../action";
import { assertNotDemo, BUSINESS_COOKIE, getContext, LOCATION_COOKIE, requireActionContext } from "../context";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

const optionalPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide (ex. 77 123 45 67)." });
      return z.NEVER;
    }
    return p;
  });

const businessSchema = z.object({
  name: z.string().trim().min(2, "Donnez un nom à votre commerce.").max(80),
  activity: z.enum(Object.keys(ACTIVITIES) as [Activity, ...Activity[]], { message: "Choisissez votre activité." }),
  phone: optionalPhone,
  city: z.string().trim().max(60).optional().default(""),
});

export async function createBusiness(input: z.input<typeof businessSchema>) {
  return runAction(async () => {
    const ctx = await getContext();
    if (!ctx) throw new ActionError("Votre session a expiré. Reconnectez-vous.");
    assertNotDemo(ctx, "La création d'un commerce");
    const data = parse(businessSchema, input);

    const businessId = await db.transaction(async (tx) => {
      const [business] = await tx
        .insert(businesses)
        .values({
          name: data.name,
          activity: data.activity,
          phone: data.phone,
          city: data.city || null,
          ...defaultModules(data.activity),
          plan: "trial",
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
          ownerId: ctx.user.id,
        })
        .returning({ id: businesses.id });
      await tx.insert(members).values({ businessId: business!.id, userId: ctx.user.id, role: "owner" });
      await tx.insert(locations).values({
        businessId: business!.id,
        name: data.activity === "ecommerce" ? "Stock principal" : "Boutique principale",
        kind: data.activity === "ecommerce" ? "depot" : "boutique",
      });
      return business!.id;
    });

    const jar = await cookies();
    jar.set(BUSINESS_COOKIE, businessId, cookieOptions);
    jar.delete(LOCATION_COOKIE);
    return { businessId };
  });
}

export async function switchBusiness(businessId: string) {
  return runAction(async () => {
    const ctx = await getContext();
    if (!ctx) throw new ActionError("Votre session a expiré. Reconnectez-vous.");
    if (!ctx.memberships.some((m) => m.businessId === businessId)) throw new ActionError("Commerce introuvable.");
    const jar = await cookies();
    jar.set(BUSINESS_COOKIE, businessId, cookieOptions);
    jar.delete(LOCATION_COOKIE);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function switchLocation(locationId: string) {
  return runAction(async () => {
    const ctx = await requireActionContext(undefined, { write: false });
    if (!ctx.locations.some((l) => l.id === locationId)) throw new ActionError("Boutique introuvable.");
    (await cookies()).set(LOCATION_COOKIE, locationId, cookieOptions);
    revalidatePath("/", "layout");
    return null;
  });
}

const settingsSchema = z.object({
  name: z.string().trim().min(2, "Donnez un nom à votre commerce.").max(80),
  phone: optionalPhone,
  address: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(60).optional().default(""),
  logo: z
    .string()
    .max(400_000, "Logo trop lourd.")
    .refine((v) => v === "" || v.startsWith("data:image/"), "Image invalide.")
    .nullable()
    .optional(),
});

export async function updateBusiness(input: z.input<typeof settingsSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("settings.manage");
    assertNotDemo(ctx, "La modification des réglages");
    const data = parse(settingsSchema, input);
    await db
      .update(businesses)
      .set({
        name: data.name,
        phone: data.phone,
        address: data.address || null,
        city: data.city || null,
        ...(data.logo !== undefined ? { logo: data.logo || null } : {}),
      })
      .where(eq(businesses.id, ctx.business.id));
    revalidatePath("/", "layout");
    return null;
  });
}

export async function updateModules(input: { modulePos: boolean; moduleOrders: boolean }) {
  return runAction(async () => {
    const ctx = await requireActionContext("settings.manage");
    assertNotDemo(ctx, "La modification des réglages");
    const data = parse(z.object({ modulePos: z.boolean(), moduleOrders: z.boolean() }), input);
    await db.update(businesses).set(data).where(eq(businesses.id, ctx.business.id));
    revalidatePath("/", "layout");
    return null;
  });
}

const locationSchema = z.object({
  name: z.string().trim().min(2, "Donnez un nom à la boutique ou au dépôt.").max(60),
  kind: z.enum(["boutique", "depot"]),
});

export async function createLocation(input: z.input<typeof locationSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("settings.manage");
    assertNotDemo(ctx, "La modification des réglages");
    const data = parse(locationSchema, input);
    if (!canAdd(ctx.plan.limits.maxLocations, ctx.locations.length)) {
      throw new ActionError(
        ctx.plan.plan === "business"
          ? `Votre formule permet ${ctx.plan.limits.maxLocations} boutiques ou dépôts au maximum.`
          : "Plusieurs boutiques ou dépôts sont disponibles avec la formule Business.",
      );
    }
    await db.insert(locations).values({ businessId: ctx.business.id, ...data });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function renameLocation(input: { id: string } & z.input<typeof locationSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("settings.manage");
    assertNotDemo(ctx, "La modification des réglages");
    const data = parse(locationSchema.extend({ id: z.string() }), input);
    await db
      .update(locations)
      .set({ name: data.name, kind: data.kind })
      .where(and(eq(locations.id, data.id), eq(locations.businessId, ctx.business.id)));
    revalidatePath("/", "layout");
    return null;
  });
}

/** Couleur de l'application : réservée aux commerces qui ont acheté leur licence. */
export async function updateBrandColor(color: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("settings.manage");
    assertNotDemo(ctx, "La personnalisation");
    if (!ctx.plan.license) throw new ActionError("La personnalisation des couleurs est incluse dans les licences Sama Stock.");
    const value = parse(z.enum(Object.keys(BRAND_COLORS) as [BrandColor, ...BrandColor[]], { message: "Couleur inconnue." }), color);
    await db.update(businesses).set({ brandColor: value }).where(eq(businesses.id, ctx.business.id));
    revalidatePath("/", "layout");
    return null;
  });
}

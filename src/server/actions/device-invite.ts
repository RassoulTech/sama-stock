"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { businesses, members } from "@/db/schema";
import { inviteDeviceToken, verifyDeviceInvite } from "@/lib/domain/device-invite";
import { SHOP_COOKIE } from "@/lib/shop-app";
import { ActionError, parse, runAction } from "../action";
import { getSession } from "../context";
import { shopBySlug } from "../queries/shop-login";
import { createDevice, DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, SHOP_COOKIE_OPTIONS } from "../services/devices";

const EXPIRED = "Ce QR code n'est plus valable. Demandez au propriétaire d'en afficher un nouveau (Équipe › Activer un autre appareil).";

/**
 * Active l'appareil qui a scanné le QR code du propriétaire. Pas de session ici : c'est le jeton signé qui
 * prouve l'accord du propriétaire. Il ne sert qu'une fois (jeton d'appareil dérivé, unique en base).
 */
export async function activateInvitedDevice(token: string, name: string) {
  return runAction(async () => {
    const secret = process.env.BETTER_AUTH_SECRET ?? "";
    const invite = verifyDeviceInvite(secret, String(token ?? ""));
    if (!invite) throw new ActionError(EXPIRED);
    const label = parse(z.string().trim().min(2, "Donnez un nom à cet appareil (ex. : Téléphone de Moussa).").max(60), name);

    // Le propriétaire qui a montré le QR code a toujours la main sur le commerce
    const [owner] = await db
      .select({ slug: businesses.slug, suspendedAt: businesses.suspendedAt, isDemo: businesses.isDemo })
      .from(members)
      .innerJoin(businesses, eq(businesses.id, members.businessId))
      .where(and(eq(members.businessId, invite.businessId), eq(members.userId, invite.userId), eq(members.role, "owner")));
    if (!owner?.slug || owner.isDemo) throw new ActionError(EXPIRED);
    if (owner.suspendedAt) throw new ActionError("Ce commerce est suspendu. Contactez Sama Stock.");

    let cookie: string;
    try {
      ({ cookie } = await createDevice({
        businessId: invite.businessId,
        name: label,
        createdBy: invite.userId,
        token: inviteDeviceToken(secret, invite.nonce),
      }));
    } catch (error) {
      // Index unique sur l'empreinte du jeton : ce QR code a déjà activé un appareil
      if ((error as { code?: string; cause?: { code?: string } }).code === "23505" || (error as { cause?: { code?: string } }).cause?.code === "23505") {
        throw new ActionError("Ce QR code a déjà servi pour un appareil. Demandez-en un nouveau au propriétaire.");
      }
      throw error;
    }
    const jar = await cookies();
    jar.set(DEVICE_COOKIE, cookie, DEVICE_COOKIE_OPTIONS);
    jar.set(SHOP_COOKIE, owner.slug, SHOP_COOKIE_OPTIONS);
    return { slug: owner.slug };
  });
}

/**
 * Le propriétaire vient de taper son e-mail et son mot de passe sur la page de sa boutique : ce téléphone devient un
 * appareil de la boutique (clavier du code PIN). La page ferme ensuite sa session pour laisser la place aux employés.
 */
export async function activateShopDeviceAsOwner(slug: string, name: string) {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw new ActionError("E-mail ou mot de passe incorrect.");
    const label = parse(z.string().trim().min(2, "Donnez un nom à cet appareil (ex. : Téléphone de la caisse).").max(60), name);
    const shop = await shopBySlug(String(slug ?? ""));
    if (!shop) throw new ActionError("Boutique introuvable.");
    const [owner] = await db
      .select({ isDemo: businesses.isDemo, suspendedAt: businesses.suspendedAt })
      .from(members)
      .innerJoin(businesses, eq(businesses.id, members.businessId))
      .where(and(eq(members.businessId, shop.id), eq(members.userId, session.user.id), eq(members.role, "owner")));
    if (!owner || owner.isDemo) throw new ActionError(`Seul le propriétaire de ${shop.name} peut activer un téléphone pour les codes PIN.`);
    if (owner.suspendedAt) throw new ActionError("Ce commerce est suspendu. Contactez Sama Stock.");

    const { cookie } = await createDevice({ businessId: shop.id, name: label, createdBy: session.user.id });
    const jar = await cookies();
    jar.set(DEVICE_COOKIE, cookie, DEVICE_COOKIE_OPTIONS);
    jar.set(SHOP_COOKIE, shop.slug!, SHOP_COOKIE_OPTIONS);
    return { slug: shop.slug! };
  });
}

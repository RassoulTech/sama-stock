import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { shopDevices, user } from "@/db/schema";

/** Cookie de l'appareil de la boutique : « <id>.<jeton> » (le jeton n'est jamais gardé en clair en base). */
export const DEVICE_COOKIE = "ss_device";
export const DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365 * 2,
};

export interface ShopDevice {
  id: string;
  businessId: string;
  name: string;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Boutique ouverte sur cet appareil (son adresse /b/…) : la page de connexion y ramène. Rien de secret. */
export const SHOP_COOKIE_OPTIONS = { ...DEVICE_COOKIE_OPTIONS, httpOnly: false };

/**
 * Nouvel appareil : renvoie la valeur du cookie à poser sur cet appareil.
 * `token` est fourni pour une invitation par QR code (toujours le même : l'invitation ne sert qu'une fois).
 */
export async function createDevice(input: {
  businessId: string;
  name: string;
  createdBy: string;
  token?: string;
}): Promise<{ device: ShopDevice; cookie: string }> {
  const token = input.token ?? randomBytes(32).toString("base64url");
  const [row] = await db
    .insert(shopDevices)
    .values({ businessId: input.businessId, name: input.name, tokenHash: hashToken(token), createdBy: input.createdBy })
    .returning({ id: shopDevices.id, businessId: shopDevices.businessId, name: shopDevices.name });
  return { device: row!, cookie: `${row!.id}.${token}` };
}

/** Appareil correspondant à la valeur du cookie, s'il existe et n'a pas été retiré. */
export async function deviceFromCookieValue(value: string | undefined | null): Promise<ShopDevice | null> {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!token) return null;
  const [row] = await db
    .select({ id: shopDevices.id, businessId: shopDevices.businessId, name: shopDevices.name, tokenHash: shopDevices.tokenHash })
    .from(shopDevices)
    .where(and(eq(shopDevices.id, id), isNull(shopDevices.revokedAt)));
  if (!row || row.tokenHash !== hashToken(token)) return null;
  return { id: row.id, businessId: row.businessId, name: row.name };
}

/** Appareil de la boutique de la requête en cours (pages, actions, routes). */
export async function readDevice(): Promise<ShopDevice | null> {
  return deviceFromCookieValue((await cookies()).get(DEVICE_COOKIE)?.value);
}

export async function touchDevice(id: string) {
  await db.update(shopDevices).set({ lastSeenAt: new Date() }).where(eq(shopDevices.id, id));
}

export async function listDevices(businessId: string) {
  return db
    .select({
      id: shopDevices.id,
      name: shopDevices.name,
      createdAt: shopDevices.createdAt,
      lastSeenAt: shopDevices.lastSeenAt,
      createdByName: user.name,
    })
    .from(shopDevices)
    .leftJoin(user, eq(user.id, shopDevices.createdBy))
    .where(and(eq(shopDevices.businessId, businessId), isNull(shopDevices.revokedAt)))
    .orderBy(desc(shopDevices.createdAt));
}

export async function revokeDevice(businessId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(shopDevices)
    .set({ revokedAt: new Date() })
    .where(and(eq(shopDevices.id, id), eq(shopDevices.businessId, businessId), isNull(shopDevices.revokedAt)))
    .returning({ id: shopDevices.id });
  return rows.length > 0;
}

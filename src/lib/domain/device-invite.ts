import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Invitation à activer un appareil de la boutique (QR code affiché par le propriétaire).
 * Rien n'est stocké : le jeton est signé et expire vite. Il ne sert qu'une fois, car l'appareil créé reçoit un
 * jeton dérivé de `nonce` et l'index unique de `shop_devices.token_hash` refuse un second appareil identique.
 */
export const DEVICE_INVITE_MINUTES = 15;

export interface DeviceInvite {
  businessId: string;
  /** Propriétaire qui a affiché le QR code (inscrit comme « activé par »). */
  userId: string;
  expiresAt: Date;
  nonce: string;
}

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function key(secret: string): Buffer {
  return createHmac("sha256", secret).update("sama-stock:device-invite").digest();
}

function signature(secret: string, payload: string): string {
  return createHmac("sha256", key(secret)).update(payload).digest("base64url").slice(0, 22);
}

/** Jeton `<b>.<u>.<expiration>.<nonce>.<signature>` (identifiants et nonce en caractères d'adresse). */
export function signDeviceInvite(secret: string, invite: DeviceInvite): string {
  const payload = [invite.businessId, invite.userId, Math.floor(invite.expiresAt.getTime() / 1000).toString(36), invite.nonce].join(".");
  return `${payload}.${signature(secret, payload)}`;
}

export function verifyDeviceInvite(secret: string, token: string, now: Date = new Date()): DeviceInvite | null {
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [businessId, userId, exp, nonce, sig] = parts as [string, string, string, string, string];
  if (!ID_RE.test(businessId) || !ID_RE.test(userId) || !ID_RE.test(nonce) || !/^[0-9a-z]{1,10}$/.test(exp)) return null;
  const expected = Buffer.from(signature(secret, [businessId, userId, exp, nonce].join(".")));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const expiresAt = new Date(parseInt(exp, 36) * 1000);
  if (expiresAt.getTime() <= now.getTime()) return null;
  return { businessId, userId, expiresAt, nonce };
}

/** Jeton secret de l'appareil créé par une invitation : toujours le même pour une même invitation. */
export function inviteDeviceToken(secret: string, nonce: string): string {
  return createHmac("sha256", key(secret)).update(`device:${nonce}`).digest("base64url");
}

import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members, user } from "@/db/schema";
import { isLocked, isValidPin, minutesLeft, PIN_LOCK_MINUTES, PIN_MAX_FAILURES, PIN_SESSION_HOURS, pinFailureState } from "@/lib/domain/staff-pin";
import { DEVICE_COOKIE, deviceFromCookieValue, touchDevice } from "@/server/services/devices";

/**
 * Connexion d'un employé avec son code PIN, seulement depuis un appareil activé par le propriétaire.
 * L'employé choisit son nom (memberId) puis tape son code ; la session dure au plus une journée de travail.
 */
export function pinSignIn() {
  return {
    id: "sama-pin-sign-in",
    endpoints: {
      pinSignIn: createAuthEndpoint(
        "/pin/sign-in",
        { method: "POST", body: z.object({ memberId: z.string().min(1).max(64), pin: z.string().max(12) }) },
        async (ctx) => {
          const device = await deviceFromCookieValue(ctx.getCookie(DEVICE_COOKIE));
          if (!device) throw new APIError("FORBIDDEN", { message: "Cet appareil n'est pas activé pour la boutique." });

          const [row] = await db
            .select({ member: members, user })
            .from(members)
            .innerJoin(user, eq(user.id, members.userId))
            .where(and(eq(members.id, ctx.body.memberId), eq(members.businessId, device.businessId)));
          if (!row?.member.pinHash) throw new APIError("UNAUTHORIZED", { message: "Code incorrect." });

          const now = new Date();
          const locked = row.member.pinLockedUntil;
          if (locked && isLocked(locked, now)) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: `Trop de codes faux : réessayez dans ${minutesLeft(locked, now)} min, ou demandez un nouveau code au propriétaire.`,
            });
          }

          const ok = isValidPin(ctx.body.pin) && (await verifyPassword({ hash: row.member.pinHash, password: ctx.body.pin }));
          if (!ok) {
            const next = pinFailureState(row.member.pinFailures, now);
            await db.update(members).set({ pinFailures: next.failures, pinLockedUntil: next.lockedUntil }).where(eq(members.id, row.member.id));
            if (next.lockedUntil) {
              throw new APIError("TOO_MANY_REQUESTS", { message: `Trop de codes faux : accès bloqué ${PIN_LOCK_MINUTES} minutes.` });
            }
            const left = PIN_MAX_FAILURES - next.failures;
            throw new APIError("UNAUTHORIZED", { message: `Code incorrect. Encore ${left} essai${left > 1 ? "s" : ""}.` });
          }

          await db.update(members).set({ pinFailures: 0, pinLockedUntil: null }).where(eq(members.id, row.member.id));
          await touchDevice(device.id);
          const session = await ctx.context.internalAdapter.createSession(row.user.id, false, {
            expiresAt: new Date(now.getTime() + PIN_SESSION_HOURS * 60 * 60 * 1000),
          });
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Impossible d'ouvrir la session. Réessayez." });
          await setSessionCookie(ctx, { session, user: row.user });
          return ctx.json({ ok: true });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}

import "server-only";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { account, session } from "@/db/schema";

/** Mot de passe provisoire lisible à l'oral (sans 0/O ni 1/I/l) : Sama-ABCD-EFGH. */
export function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `Sama-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/**
 * Donne un nouveau mot de passe à un compte (créé s'il se connectait seulement avec Google).
 * Option : déconnecte tous ses appareils, pour que l'ancien mot de passe ne serve plus nulle part.
 */
export async function setCredentialPassword(exec: DbOrTx, userId: string, password: string, opts: { signOutEverywhere?: boolean } = {}) {
  const hash = await hashPassword(password);
  const [cred] = await exec
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  if (cred) await exec.update(account).set({ password: hash, updatedAt: new Date() }).where(eq(account.id, cred.id));
  else {
    await exec.insert(account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hash,
      updatedAt: new Date(),
    });
  }
  if (opts.signOutEverywhere) await exec.delete(session).where(eq(session.userId, userId));
}

import "server-only";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import type { z } from "zod";

/** Erreur « métier » dont le message est montré tel quel à l'utilisateur. */
export class ActionError extends Error {}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError) return { ok: false, error: error.message };
    console.error("[action]", error);
    try {
      // Import à la demande : app-errors importe ce fichier (ActionError)
      after(async () => {
        const { currentRoute, reportServerError } = await import("./services/app-errors");
        await reportServerError(error, await currentRoute());
      });
    } catch {
      // Hors d'une requête (script) : rien à enregistrer
    }
    return { ok: false, error: "Une erreur inattendue est survenue. Réessayez." };
  }
}

export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ActionError(result.error.issues[0]?.message ?? "Données invalides.");
  }
  return result.data;
}

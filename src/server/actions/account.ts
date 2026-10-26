"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ActionError, parse, runAction } from "../action";
import { getSession } from "../context";

const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères.")
  .max(128, "Le mot de passe est trop long.");

/** Ajoute un mot de passe à un compte créé avec Google : la connexion par e-mail devient possible. */
export async function createOwnPassword(newPassword: string) {
  return runAction(async () => {
    const session = await getSession();
    if (!session) throw new ActionError("Votre session a expiré. Reconnectez-vous.");
    const password = parse(passwordSchema, newPassword);
    try {
      await auth.api.setPassword({ body: { newPassword: password }, headers: await headers() });
    } catch {
      throw new ActionError("Ce compte a déjà un mot de passe : utilisez « Changer le mot de passe ».");
    }
    return null;
  });
}

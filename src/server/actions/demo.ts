"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ActionError, runAction } from "../action";
import { BUSINESS_COOKIE, LOCATION_COOKIE } from "../context";
import { demoPassword, ensureDemo, isDemoPlan, resetDemoPassword } from "../demo";

/** Ouvre la boutique de démonstration d'une formule (Essai, Pro ou Business) et y connecte le visiteur. */
export async function enterDemo(plan: string) {
  const res = await runAction(async () => {
    if (!isDemoPlan(plan)) throw new ActionError("Formule inconnue.");
    const { email, businessId } = await ensureDemo(plan);
    const signIn = async () =>
      auth.api.signInEmail({ body: { email, password: demoPassword(plan), rememberMe: false }, headers: await headers() });
    try {
      await signIn();
    } catch {
      // Le mot de passe interne a pu être créé avec un autre secret (ordinateur / site) : on le réaligne
      await resetDemoPassword(plan);
      await signIn();
    }
    const jar = await cookies();
    jar.set(BUSINESS_COOKIE, businessId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
    jar.delete(LOCATION_COOKIE);
    return null;
  });
  if (res.ok) redirect("/tableau-de-bord");
  return res;
}

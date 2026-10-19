import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { isGoogleEnabled } from "@/lib/auth";
import { safeRedirect } from "@/lib/safe-redirect";
import { getSession } from "@/server/context";

export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const redirectTo = safeRedirect(params.redirect, "/tableau-de-bord");
  if (await getSession()) redirect(redirectTo);
  return <SignInForm redirectTo={redirectTo} googleEnabled={isGoogleEnabled} />;
}

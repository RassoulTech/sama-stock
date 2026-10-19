import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { isGoogleEnabled } from "@/lib/auth";
import { safeRedirect } from "@/lib/safe-redirect";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/server/context";

export const metadata: Metadata = pageMetadata({
  title: "Connexion",
  description: "Connectez-vous à Sama Stock pour suivre votre stock, vos ventes, vos commandes en ligne et les crédits de vos clients.",
  path: "/connexion",
});

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

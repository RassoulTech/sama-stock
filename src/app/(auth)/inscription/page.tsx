import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { isGoogleEnabled } from "@/lib/auth";
import { safeRedirect } from "@/lib/safe-redirect";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/server/context";

export const metadata: Metadata = pageMetadata({
  title: "Créer un compte gratuit",
  description: "Créez votre compte Sama Stock en quelques minutes : 14 jours gratuits, sans carte bancaire. Pour boutiques, e-commerçants et entrepreneurs.",
  path: "/inscription",
});

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect ? safeRedirect(params.redirect, "/demarrage") : null;
  if (await getSession()) redirect(redirectTo ?? "/tableau-de-bord");
  const email = typeof params.email === "string" ? params.email : undefined;
  return (
    <SignUpForm
      redirectTo={redirectTo}
      googleEnabled={isGoogleEnabled}
      defaultEmail={email}
      lockEmail={Boolean(redirectTo?.startsWith("/invitation/"))}
    />
  );
}

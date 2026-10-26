import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { Button } from "@/components/ui/button";
import { NO_INDEX } from "@/lib/seo";
import { shopBySlug } from "@/server/queries/shop-login";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: NO_INDEX };

/** Ouverte depuis le lien reçu par e-mail : ?token=… (ou ?error=INVALID_TOKEN si le lien a expiré). */
export default async function ReinitialiserPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const shop = typeof query.b === "string" ? await shopBySlug(query.b) : null;
  const token = typeof query.token === "string" && query.error === undefined ? query.token : null;
  const loginHref = shop ? `/b/${shop.slug}` : "/connexion";
  const forgotHref = shop ? `/mot-de-passe-oublie?b=${shop.slug}` : "/mot-de-passe-oublie";

  return (
    <AuthShell shop={shop}>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground">
            {token ? "Choisissez votre nouveau mot de passe." : "Ce lien n'est plus valable : il a déjà servi ou il a plus d'une heure."}
          </p>
        </div>
        {token ? (
          <ResetPasswordForm token={token} loginHref={loginHref} />
        ) : (
          <Button asChild size="lg" className="w-full">
            <Link href={forgotHref}>Recevoir un nouveau lien</Link>
          </Button>
        )}
      </div>
    </AuthShell>
  );
}

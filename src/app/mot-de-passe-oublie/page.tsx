import { ArrowLeft, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { LEGAL } from "@/lib/legal";
import { NO_INDEX } from "@/lib/seo";
import { isMailEnabled } from "@/server/mail";
import { shopBySlug } from "@/server/queries/shop-login";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: NO_INDEX };

export default async function MotDePasseOubliePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const shop = typeof query.b === "string" ? await shopBySlug(query.b) : null;
  const email = typeof query.email === "string" && /^[^\s@]+@[^\s@]+$/.test(query.email) ? query.email.slice(0, 120) : "";
  const loginHref = shop ? `/b/${shop.slug}` : "/connexion";

  return (
    <AuthShell shop={shop}>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold">Mot de passe oublié</h1>
          <p className="text-sm text-muted-foreground">
            {isMailEnabled
              ? "Entrez l'e-mail de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe."
              : "Voici comment retrouver l'accès à votre compte."}
          </p>
        </div>

        {isMailEnabled ? (
          <ForgotPasswordForm defaultEmail={email} slug={shop?.slug ?? null} />
        ) : (
          <p className="rounded-xl border bg-muted/40 p-4 text-sm">
            Vous êtes le propriétaire du commerce ? Écrivez-nous depuis l&apos;adresse e-mail de votre compte à{" "}
            <a href={`mailto:${LEGAL.email}?subject=${encodeURIComponent("Mot de passe oublié")}`} className="font-medium text-primary underline-offset-4 hover:underline">
              {LEGAL.email}
            </a>{" "}
            : nous vous créons un nouveau mot de passe.
          </p>
        )}

        <div className="flex gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
          <Users className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium">Vous êtes employé de la boutique ?</span>{" "}
            <span className="text-muted-foreground">
              Demandez au propriétaire : il peut vous créer un nouveau mot de passe depuis la page Équipe, sans e-mail.
            </span>
          </p>
        </div>

        <Link href={loginHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Retour à la connexion
        </Link>
      </div>
    </AuthShell>
  );
}

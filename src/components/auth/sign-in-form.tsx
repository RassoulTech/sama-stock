"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { GoogleButton, OrSeparator } from "./google-button";
import { PasswordInput } from "./password-input";

export function SignInForm({
  redirectTo,
  googleEnabled,
  defaultEmail = "",
  brand = null,
  notice = null,
}: {
  redirectTo: string;
  googleEnabled: boolean;
  /** E-mail déjà rempli (lien d'accès envoyé au client par WhatsApp). */
  defaultEmail?: string;
  /** Page de connexion d'une boutique : à son nom, sans inscription (Google seulement hors licence, décidé par la page). */
  brand?: { name: string; slug: string } | null;
  /** Message affiché au-dessus du formulaire (par exemple : compte sans accès à cette boutique). */
  notice?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const withGoogle = googleEnabled;

  async function signIn(credentials: { email: string; password: string }) {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email(credentials);
    if (error) {
      setPending(false);
      const message = authErrorMessage(error);
      // Compte créé avec Google : il n'a pas de mot de passe, le bouton Google est le bon chemin
      setError(
        error.code === "INVALID_EMAIL_OR_PASSWORD" && withGoogle
          ? `${message} Si vous avez créé votre compte avec Google, utilisez « Continuer avec Google » ci-dessus.`
          : message,
      );
      return;
    }
    // Page d'une boutique : on ouvre directement cette boutique (même si le compte en a plusieurs)
    router.replace(brand ? `/b/${brand.slug}/entrer` : redirectTo);
    router.refresh();
  }

  const forgot = new URLSearchParams();
  if (brand) forgot.set("b", brand.slug);
  if (email.trim()) forgot.set("email", email.trim());
  const forgotHref = `/mot-de-passe-oublie${forgot.size ? `?${forgot}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">{brand ? "Connexion" : "Bon retour !"}</h1>
        <p className="text-sm text-muted-foreground">
          {brand
            ? `Entrez votre e-mail et votre mot de passe pour ouvrir l'application de ${brand.name}.`
            : "Connectez-vous pour retrouver votre commerce."}
        </p>
      </div>

      {notice && (
        <p role="status" className="rounded-xl bg-saffron/15 px-3 py-2 text-sm text-warning dark:text-saffron">
          {notice}
        </p>
      )}

      {withGoogle && (
        <>
          <GoogleButton callbackURL={brand ? `/b/${brand.slug}/entrer` : redirectTo} newUserCallbackURL="/demarrage" />
          <OrSeparator />
        </>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn({ email: email.trim(), password });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.sn"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Mot de passe</Label>
            <Link href={forgotHref} className="text-xs font-medium text-primary hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Se connecter
        </Button>
      </form>

      {!brand && (
        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href={`/inscription${redirectTo !== "/tableau-de-bord" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-semibold text-primary hover:underline"
          >
            Essai gratuit 14 jours
          </Link>
          <span className="mt-1 block">
            Juste pour voir ?{" "}
            <Link href="/demo" className="font-semibold text-primary hover:underline">
              Essayer la démo
            </Link>
          </span>
        </p>
      )}
    </div>
  );
}

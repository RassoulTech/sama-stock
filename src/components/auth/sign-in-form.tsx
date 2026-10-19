"use client";

import { Loader2, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { GoogleButton, OrSeparator } from "./google-button";
import { PasswordInput } from "./password-input";

export const DEMO_ACCOUNT = { email: "awa@demo.sn", password: "samastock2026" };

export function SignInForm({ redirectTo, googleEnabled }: { redirectTo: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn(credentials: { email: string; password: string }) {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email(credentials);
    if (error) {
      setPending(false);
      setError(authErrorMessage(error));
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Bon retour !</h1>
        <p className="text-sm text-muted-foreground">Connectez-vous pour retrouver votre commerce.</p>
      </div>

      {googleEnabled && (
        <>
          <GoogleButton callbackURL={redirectTo} newUserCallbackURL="/demarrage" />
          <OrSeparator />
        </>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn({ email, password });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.sn"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

      <div className="rounded-xl border border-dashed border-primary/30 bg-accent/60 p-4">
        <p className="text-sm font-semibold text-accent-foreground">Envie de voir l&apos;application en action ?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Un commerce de démonstration avec produits, ventes et commandes déjà remplis.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full bg-card"
          disabled={pending}
          onClick={() => {
            setEmail(DEMO_ACCOUNT.email);
            setPassword(DEMO_ACCOUNT.password);
            void signIn(DEMO_ACCOUNT);
          }}
        >
          <PlayCircle />
          Essayer le compte de démonstration
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link
          href={`/inscription${redirectTo !== "/tableau-de-bord" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className="font-semibold text-primary hover:underline"
        >
          Essai gratuit 14 jours
        </Link>
      </p>
    </div>
  );
}

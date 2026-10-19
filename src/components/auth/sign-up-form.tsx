"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { GoogleButton, OrSeparator } from "./google-button";
import { PasswordInput } from "./password-input";

export function SignUpForm({
  redirectTo,
  googleEnabled,
  defaultEmail,
  lockEmail = false,
}: {
  redirectTo: string | null;
  googleEnabled: boolean;
  defaultEmail?: string;
  /** Email imposé par une invitation : non modifiable */
  lockEmail?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const target = redirectTo ?? "/demarrage";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
    if (error) {
      setPending(false);
      setError(authErrorMessage(error));
      return;
    }
    router.replace(target);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Créez votre compte</h1>
        <p className="text-sm text-muted-foreground">14 jours d&apos;essai gratuit, sans engagement.</p>
      </div>

      {googleEnabled && (
        <>
          <GoogleButton callbackURL={target} newUserCallbackURL={target} />
          <OrSeparator />
        </>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">Votre nom</Label>
          <Input
            id="name"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Awa Diop"
          />
        </div>
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
            readOnly={lockEmail}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className={`flex items-center gap-1.5 text-xs ${password.length >= 8 ? "text-success" : "text-muted-foreground"}`}>
            <Check className="size-3.5" /> Au moins 8 caractères
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Créer mon compte
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Déjà inscrit ?{" "}
        <Link
          href={`/connexion${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className="font-semibold text-primary hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}

"use client";

import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { PasswordInput } from "./password-input";

/** Demande d'un lien de réinitialisation par e-mail (réponse identique que le compte existe ou non). */
export function ForgotPasswordForm({ defaultEmail, slug }: { defaultEmail: string; slug: string | null }) {
  const [email, setEmail] = useState(defaultEmail);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: slug ? `/reinitialiser-mot-de-passe?b=${slug}` : "/reinitialiser-mot-de-passe",
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <MailCheck className="mx-auto size-10 text-primary" />
        <p className="font-semibold">Regardez votre boîte e-mail</p>
        <p className="text-sm text-muted-foreground">
          Si un compte existe avec <span className="font-medium text-foreground">{email.trim()}</span>, vous allez recevoir un lien pour
          choisir un nouveau mot de passe. Il est valable 1 heure. Pensez à regarder dans les courriers indésirables.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Votre e-mail</Label>
        <Input
          id="reset-email"
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
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Recevoir le lien
      </Button>
    </form>
  );
}

/** Choix du nouveau mot de passe, à partir du lien reçu par e-mail. */
export function ResetPasswordForm({ token, loginHref }: { token: string; loginHref: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Le mot de passe doit faire au moins 8 caractères.");
    if (password !== confirm) return setError("Les deux mots de passe ne sont pas identiques.");
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="font-semibold">Mot de passe changé</p>
        <p className="text-sm text-muted-foreground">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
        <Button asChild size="lg" className="w-full">
          <Link href={loginHref}>Se connecter</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Nouveau mot de passe</Label>
        <PasswordInput id="new-password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
        <p className="text-xs text-muted-foreground">8 caractères au moins.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirmez-le</Label>
        <PasswordInput id="confirm-password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}

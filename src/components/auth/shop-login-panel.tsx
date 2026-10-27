"use client";

import { KeySquare, Loader2, Mail, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { FormError, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { activateShopDeviceAsOwner } from "@/server/actions/device-invite";
import { PasswordInput } from "./password-input";
import { SignInForm } from "./sign-in-form";
import { StaffLogin, type StaffEntry } from "./staff-login";

type Mode = "pin" | "email";

/**
 * Page de connexion d'une boutique, deux onglets :
 * - Code PIN : noms et clavier sur un appareil activé (staff ≠ null) ; sinon, activation du téléphone en une fois ;
 * - E-mail : e-mail et mot de passe (propriétaire, gérant, employé avec un accès par e-mail).
 */
export function ShopLoginPanel({
  slug,
  shopName,
  staff,
  defaultEmail,
  notice,
  googleEnabled = false,
}: {
  slug: string;
  shopName: string;
  staff: StaffEntry[] | null;
  defaultEmail: string;
  notice: string | null;
  /** Boutique sans licence : son propriétaire a pu créer son compte avec Google. */
  googleEnabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(staff && !defaultEmail && !notice ? "pin" : "email");

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Façon de se connecter" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ["pin", "Code PIN", KeySquare],
            ["email", "E-mail", Mail],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground transition-colors",
              mode === key && "bg-card text-foreground shadow-sm",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "email" ? (
        <SignInForm redirectTo="/tableau-de-bord" googleEnabled={googleEnabled} defaultEmail={defaultEmail} brand={{ name: shopName, slug }} notice={notice} />
      ) : staff ? (
        <StaffLogin slug={slug} staff={staff} />
      ) : (
        <ActivateForPin slug={slug} shopName={shopName} />
      )}
    </div>
  );
}

/**
 * Téléphone pas encore activé : le code PIN y est bloqué (sécurité). Le propriétaire l'active une fois, ici même,
 * avec son e-mail et son mot de passe, ou en scannant son QR code. Ensuite les employés tapent leur code.
 */
function ActivateForPin({ slug, shopName }: { slug: string; shopName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("Téléphone de la boutique");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function activate() {
    setPending(true);
    setError(null);
    const signIn = await authClient.signIn.email({ email: email.trim(), password });
    if (signIn.error) {
      setPending(false);
      setError(authErrorMessage(signIn.error));
      return;
    }
    const res = await activateShopDeviceAsOwner(slug, name);
    // La session du propriétaire est fermée dans tous les cas : ce téléphone sert aux codes PIN des employés
    await authClient.signOut().catch(() => null);
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    // Navigation complète : la page relit le cookie de l'appareil et affiche les noms et le clavier
    window.location.replace(`/b/${res.data.slug}?installer=1`);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Connexion par code PIN</h1>
        <p className="text-sm text-muted-foreground">
          Pour la sécurité, le code PIN marche seulement sur les téléphones et tablettes de {shopName}. Ce téléphone n&apos;est pas
          encore activé : le propriétaire l&apos;active une seule fois.
        </p>
      </div>

      {open ? (
        <form
          className="space-y-4 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void activate();
          }}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" /> Compte du propriétaire
          </p>
          <FormField label="E-mail" htmlFor="owner-email">
            <Input
              id="owner-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </FormField>
          <FormField label="Mot de passe" htmlFor="owner-password">
            <PasswordInput id="owner-password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          </FormField>
          <FormField label="Nom de cet appareil" htmlFor="device-name" hint="Pour le reconnaître dans Équipe : « Téléphone de la caisse », « Tablette »…">
            <Input id="device-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className="h-11" />
          </FormField>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Smartphone />} Activer ce téléphone
          </Button>
          <p className="text-xs text-muted-foreground">
            Votre session n&apos;est pas gardée sur ce téléphone : ensuite, chaque employé touche son nom et tape son code.
          </p>
        </form>
      ) : (
        <Button type="button" size="lg" className="h-auto min-h-11 w-full py-2.5 whitespace-normal" onClick={() => setOpen(true)}>
          <Smartphone /> Propriétaire : activer ce téléphone
        </Button>
      )}

      <p className="flex gap-2.5 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
        <QrCode className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Ou, depuis le téléphone du propriétaire : <strong className="text-foreground">Équipe › Activer un autre appareil</strong>, puis
          scannez le QR code avec ce téléphone.
        </span>
      </p>
    </div>
  );
}

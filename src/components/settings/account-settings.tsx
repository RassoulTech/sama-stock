"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PalettePicker } from "@/components/admin/licence/brand-picker";
import { PasswordInput } from "@/components/auth/password-input";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { DEFAULT_BRAND, normalizeBrand } from "@/lib/domain/brand";
import { createOwnPassword } from "@/server/actions/account";
import { updateBrandColor } from "@/server/actions/business";

/** Couleurs de l'application (commerces sous licence). */
export function BrandColorForm({
  color,
  logo,
  name,
  disabled,
}: {
  color: string | null;
  logo: string | null;
  name: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const initial = normalizeBrand(color) ?? DEFAULT_BRAND;
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const res = await updateBrandColor(value);
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Couleurs enregistrées");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <PalettePicker value={value} onChange={setValue} logo={logo} name={name} />
      <Button disabled={disabled || pending || value === initial} onClick={() => void save()}>
        {pending && <Loader2 className="animate-spin" />}
        Appliquer les couleurs
      </Button>
    </div>
  );
}

/** Changer son mot de passe (par exemple le mot de passe provisoire reçu à l'installation). */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast.error("Le nouveau mot de passe doit faire au moins 8 caractères.");
    if (next !== confirm) return toast.error("Les deux nouveaux mots de passe ne sont pas identiques.");
    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (error) {
      toast.error(authErrorMessage(error));
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Mot de passe changé. Vos autres appareils ont été déconnectés.");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <FormField label="Mot de passe actuel" htmlFor="pw-current">
        <PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nouveau mot de passe" htmlFor="pw-new" hint="8 caractères au moins.">
          <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </FormField>
        <FormField label="Confirmez-le" htmlFor="pw-confirm">
          <PasswordInput id="pw-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </FormField>
      </div>
      <Button type="submit" disabled={pending || !current || !next}>
        {pending && <Loader2 className="animate-spin" />}
        Changer le mot de passe
      </Button>
    </form>
  );
}

/** Compte créé avec Google : ajouter un mot de passe pour pouvoir aussi se connecter par e-mail. */
export function CreatePasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast.error("Le mot de passe doit faire au moins 8 caractères.");
    if (next !== confirm) return toast.error("Les deux mots de passe ne sont pas identiques.");
    setPending(true);
    const res = await createOwnPassword(next);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNext("");
    setConfirm("");
    toast.success("Mot de passe créé. Vous pouvez maintenant vous connecter avec votre e-mail ou avec Google.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Vous vous connectez avec Google. Créez un mot de passe pour pouvoir aussi entrer avec <span className="font-medium text-foreground">{email}</span>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Mot de passe" htmlFor="pw-create" hint="8 caractères au moins.">
          <PasswordInput id="pw-create" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </FormField>
        <FormField label="Confirmez-le" htmlFor="pw-create-confirm">
          <PasswordInput id="pw-create-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </FormField>
      </div>
      <Button type="submit" disabled={pending || !next}>
        {pending && <Loader2 className="animate-spin" />}
        Créer le mot de passe
      </Button>
    </form>
  );
}

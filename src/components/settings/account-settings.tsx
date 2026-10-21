"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ColorPicker } from "@/components/admin/licence/brand-picker";
import { PasswordInput } from "@/components/auth/password-input";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { DEFAULT_BRAND, isBrandColor, type BrandColor } from "@/lib/domain/brand";
import { updateBrandColor } from "@/server/actions/business";

/** Couleur de l'application (commerces sous licence). */
export function BrandColorForm({ color, disabled }: { color: string | null; disabled?: boolean }) {
  const router = useRouter();
  const initial = isBrandColor(color) ? color : DEFAULT_BRAND;
  const [value, setValue] = useState<BrandColor>(initial);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const res = await updateBrandColor(value);
    setPending(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Couleur enregistrée");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <ColorPicker value={value} onChange={setValue} />
      <Button disabled={disabled || pending || value === initial} onClick={() => void save()}>
        {pending && <Loader2 className="animate-spin" />}
        Appliquer la couleur
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

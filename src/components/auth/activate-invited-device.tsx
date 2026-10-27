"use client";

import { Loader2, Smartphone } from "lucide-react";
import { useState, useTransition } from "react";
import { FormError, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activateInvitedDevice } from "@/server/actions/device-invite";

/** Nom de l'appareil puis activation : ensuite, la page de connexion de la boutique montre le clavier du code PIN. */
export function ActivateInvitedDeviceForm({ token, shopName }: { token: string; shopName: string }) {
  const [name, setName] = useState("Téléphone");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await activateInvitedDevice(token, name);
          if (!res.ok) return setError(res.error);
          // Navigation complète : la page de connexion relit le nouveau cookie de l'appareil
          window.location.replace(`/b/${res.data.slug}?installer=1`);
        });
      }}
    >
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Smartphone className="size-5 text-primary" /> Activer cet appareil
        </h1>
        <p className="text-sm text-muted-foreground">
          Les employés de {shopName} pourront ouvrir leur session ici avec leur code PIN. Le propriétaire peut retirer
          l&apos;appareil à tout moment.
        </p>
      </div>
      <FormField label="Nom de l'appareil" htmlFor="device-name" hint="Pour le reconnaître dans la liste : « Téléphone de Moussa », « Tablette du dépôt »…">
        <Input id="device-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
      </FormField>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Activer
      </Button>
    </form>
  );
}

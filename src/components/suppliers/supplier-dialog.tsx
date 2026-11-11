"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ResultatPilote } from "@/components/assistant/pilote/types";
import { usePiloteEcran } from "@/components/assistant/pilote/use-pilote-ecran";
import { FormError, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSupplier, updateSupplier } from "@/server/actions/suppliers";

export function SupplierDialog({
  trigger,
  supplier,
  onSaved,
  pilote = false,
}: {
  trigger: React.ReactNode;
  supplier?: { id: string; name: string; phone: string | null; note: string | null };
  onSaved?: (s: { id: string; name: string }) => void;
  /** La fiche de la page Fournisseurs se laisse remplir par l'assistant. */
  pilote?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const formRef = useRef<HTMLFormElement | null>(null);

  function lireFiche(form: HTMLFormElement) {
    const data = new FormData(form);
    return {
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      note: String(data.get("note") ?? ""),
    };
  }

  function save(input: ReturnType<typeof lireFiche>): Promise<ResultatPilote> {
    setError(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = supplier ? await updateSupplier(supplier.id, input) : await createSupplier(input);
        if (!res.ok) {
          setError(res.error);
          resolve({ ok: false, message: res.error });
          return;
        }
        const message = supplier ? "Fournisseur mis à jour" : "Fournisseur ajouté";
        toast.success(message);
        setOpen(false);
        onSaved?.(res.data);
        resolve({ ok: true, message });
        router.refresh();
      });
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    void save(lireFiche(e.currentTarget));
  }

  // Seule la fiche de la page Fournisseurs est pilotée par l'assistant (pas celles des listes de choix)
  usePiloteEcran(
    "fournisseur",
    {
      ouvrir: () => setOpen(true),
      champ: (champ, valeur) => {
        const element = formRef.current?.elements.namedItem(champ);
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.value = valeur;
      },
      enregistrer: () => (formRef.current ? save(lireFiche(formRef.current)) : Promise.resolve({ ok: false, message: "La fiche fournisseur n'est pas ouverte." })),
    },
    pilote,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
            <DialogDescription>Le nom suffit ; le téléphone permet de le contacter rapidement.</DialogDescription>
          </DialogHeader>
          <FormField label="Nom" htmlFor="supplier-name">
            <Input id="supplier-name" data-assistant="fournisseur.nom" name="name" required minLength={2} defaultValue={supplier?.name} placeholder="Ex. Sococim Distribution" />
          </FormField>
          <FormField label="Téléphone (facultatif)" htmlFor="supplier-phone">
            <Input id="supplier-phone" data-assistant="fournisseur.telephone" name="phone" type="tel" inputMode="tel" defaultValue={supplier?.phone ?? ""} placeholder="77 123 45 67" />
          </FormField>
          <FormField label="Note (facultative)" htmlFor="supplier-note">
            <Textarea id="supplier-note" data-assistant="fournisseur.note" name="note" defaultValue={supplier?.note ?? ""} placeholder="Délais, conditions de paiement…" />
          </FormField>
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto" data-assistant="fournisseur.valider">
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

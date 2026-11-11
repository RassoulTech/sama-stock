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
import { createCustomer, updateCustomer } from "@/server/actions/customers";

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

export function CustomerDialog({
  trigger,
  customer,
  onSaved,
  open: controlledOpen,
  onOpenChange,
  defaultName,
  pilote = false,
}: {
  trigger?: React.ReactNode;
  customer?: { id: string; name: string; phone: string | null; address: string | null; note: string | null };
  onSaved?: (c: CustomerOption) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultName?: string;
  /** La fiche de la page Clients se laisse remplir par l'assistant. */
  pilote?: boolean;
}) {
  const router = useRouter();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const formRef = useRef<HTMLFormElement | null>(null);

  function lireFiche(form: HTMLFormElement) {
    const data = new FormData(form);
    return {
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      address: String(data.get("address") ?? ""),
      note: String(data.get("note") ?? ""),
    };
  }

  function save(input: ReturnType<typeof lireFiche>): Promise<ResultatPilote> {
    setError(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        const res = customer ? await updateCustomer(customer.id, input) : await createCustomer(input);
        if (!res.ok) {
          setError(res.error);
          resolve({ ok: false, message: res.error });
          return;
        }
        const message = customer ? "Client mis à jour" : "Client ajouté";
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

  // Seule la fiche de la page Clients est pilotée par l'assistant (pas celles des listes de choix)
  usePiloteEcran(
    "client",
    {
      ouvrir: () => setOpen(true),
      champ: (champ, valeur) => {
        const element = formRef.current?.elements.namedItem(champ);
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.value = valeur;
      },
      enregistrer: () => (formRef.current ? save(lireFiche(formRef.current)) : Promise.resolve({ ok: false, message: "La fiche client n'est pas ouverte." })),
    },
    pilote,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{customer ? "Modifier le client" : "Nouveau client"}</DialogTitle>
            <DialogDescription>Le téléphone permet d&apos;envoyer reçus et rappels sur WhatsApp.</DialogDescription>
          </DialogHeader>
          <FormField label="Nom" htmlFor="customer-name">
            <Input
              id="customer-name" data-assistant="client.nom"
              name="name"
              required
              minLength={2}
              defaultValue={customer?.name ?? defaultName}
              placeholder="Ex. Moussa Ndiaye"
            />
          </FormField>
          <FormField label="Téléphone" htmlFor="customer-phone">
            <Input
              id="customer-phone" data-assistant="client.telephone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={customer?.phone ?? ""}
              placeholder="77 123 45 67"
            />
          </FormField>
          <FormField label="Adresse (facultative)" htmlFor="customer-address">
            <Input id="customer-address" data-assistant="client.adresse" name="address" defaultValue={customer?.address ?? ""} placeholder="Quartier, repère…" />
          </FormField>
          {customer && (
            <FormField label="Note (facultative)" htmlFor="customer-note">
              <Textarea id="customer-note" name="note" defaultValue={customer.note ?? ""} />
            </FormField>
          )}
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto" data-assistant="client.valider">
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

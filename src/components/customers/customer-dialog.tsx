"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
}: {
  trigger?: React.ReactNode;
  customer?: { id: string; name: string; phone: string | null; address: string | null; note: string | null };
  onSaved?: (c: CustomerOption) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultName?: string;
}) {
  const router = useRouter();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const form = new FormData(e.currentTarget);
    const input = {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      address: String(form.get("address") ?? ""),
      note: String(form.get("note") ?? ""),
    };
    setError(null);
    startTransition(async () => {
      const res = customer ? await updateCustomer(customer.id, input) : await createCustomer(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(customer ? "Client mis à jour" : "Client ajouté");
      setOpen(false);
      onSaved?.(res.data);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{customer ? "Modifier le client" : "Nouveau client"}</DialogTitle>
            <DialogDescription>Le téléphone permet d&apos;envoyer reçus et rappels sur WhatsApp.</DialogDescription>
          </DialogHeader>
          <FormField label="Nom" htmlFor="customer-name">
            <Input
              id="customer-name"
              name="name"
              required
              minLength={2}
              defaultValue={customer?.name ?? defaultName}
              placeholder="Ex. Moussa Ndiaye"
            />
          </FormField>
          <FormField label="Téléphone" htmlFor="customer-phone">
            <Input
              id="customer-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={customer?.phone ?? ""}
              placeholder="77 123 45 67"
            />
          </FormField>
          <FormField label="Adresse (facultative)" htmlFor="customer-address">
            <Input id="customer-address" name="address" defaultValue={customer?.address ?? ""} placeholder="Quartier, repère…" />
          </FormField>
          {customer && (
            <FormField label="Note (facultative)" htmlFor="customer-note">
              <Textarea id="customer-note" name="note" defaultValue={customer.note ?? ""} />
            </FormField>
          )}
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

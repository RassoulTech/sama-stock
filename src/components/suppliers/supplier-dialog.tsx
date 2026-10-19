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
import { createSupplier, updateSupplier } from "@/server/actions/suppliers";

export function SupplierDialog({
  trigger,
  supplier,
  onSaved,
}: {
  trigger: React.ReactNode;
  supplier?: { id: string; name: string; phone: string | null; note: string | null };
  onSaved?: (s: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const form = new FormData(e.currentTarget);
    const input = {
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      note: String(form.get("note") ?? ""),
    };
    setError(null);
    startTransition(async () => {
      const res = supplier ? await updateSupplier(supplier.id, input) : await createSupplier(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(supplier ? "Fournisseur mis à jour" : "Fournisseur ajouté");
      setOpen(false);
      onSaved?.(res.data);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
            <DialogDescription>Le nom suffit ; le téléphone permet de le contacter rapidement.</DialogDescription>
          </DialogHeader>
          <FormField label="Nom" htmlFor="supplier-name">
            <Input id="supplier-name" name="name" required minLength={2} defaultValue={supplier?.name} placeholder="Ex. Sococim Distribution" />
          </FormField>
          <FormField label="Téléphone (facultatif)" htmlFor="supplier-phone">
            <Input id="supplier-phone" name="phone" type="tel" inputMode="tel" defaultValue={supplier?.phone ?? ""} placeholder="77 123 45 67" />
          </FormField>
          <FormField label="Note (facultative)" htmlFor="supplier-note">
            <Textarea id="supplier-note" name="note" defaultValue={supplier?.note ?? ""} placeholder="Délais, conditions de paiement…" />
          </FormField>
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

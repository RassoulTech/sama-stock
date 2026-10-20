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
import { createCategory, renameCategory } from "@/server/actions/categories";

/** Création ou renommage d'une catégorie. */
export function CategoryDialog({ trigger, category }: { trigger: React.ReactNode; category?: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "");
    setError(null);
    startTransition(async () => {
      const res = category ? await renameCategory(category.id, name) : await createCategory(name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(category ? "Catégorie renommée" : "Catégorie ajoutée");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{category ? "Renommer la catégorie" : "Nouvelle catégorie"}</DialogTitle>
            <DialogDescription>
              Les catégories regroupent vos produits (ex. Vêtements, Cosmétiques) pour filtrer et suivre leurs ventes.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Nom de la catégorie" htmlFor="category-name">
            <Input id="category-name" name="name" defaultValue={category?.name} autoFocus required maxLength={60} />
          </FormField>
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {category ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { setProductArchived } from "@/server/actions/products";

export function ArchiveProductButton({ id, archived }: { id: string; archived: boolean }) {
  return archived ? (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <ArchiveRestore /> Restaurer
        </Button>
      }
      title="Restaurer ce produit ?"
      description="Il réapparaîtra dans vos listes et à la caisse."
      confirmLabel="Restaurer"
      successMessage="Produit restauré"
      action={() => setProductArchived(id, false)}
    />
  ) : (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <Archive /> Archiver
        </Button>
      }
      title="Archiver ce produit ?"
      description="Il disparaîtra des listes et de la caisse, mais son historique de ventes et de stock est conservé. Vous pourrez le restaurer."
      confirmLabel="Archiver"
      destructive
      successMessage="Produit archivé"
      action={() => setProductArchived(id, true)}
      redirectTo="/produits"
    />
  );
}

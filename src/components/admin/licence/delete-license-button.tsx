"use client";

import { Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { adminDeleteLicenseSale } from "@/server/actions/licences";

/** Suppression définitive d'une vente de licence (et de ses paiements), après avoir retapé son numéro. */
export function DeleteLicenseButton({ saleId, number, active, compact = false }: { saleId: string; number: string; active: boolean; compact?: boolean }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" aria-label={`Supprimer la licence ${number}`}>
          <Trash2 />
          {!compact && " Supprimer la licence"}
        </Button>
      }
      title={`Supprimer la licence ${number} définitivement ?`}
      description={
        active
          ? "Le commerce perd sa licence (comme une annulation), puis la licence et tous ses paiements sont effacés de l'historique. Impossible à annuler."
          : "La licence annulée et tous ses paiements sont effacés de l'historique. Impossible à annuler."
      }
      confirmText={number}
      confirmLabel="Supprimer définitivement"
      destructive
      successMessage="Licence supprimée"
      action={(typed) => adminDeleteLicenseSale(saleId, typed)}
    />
  );
}

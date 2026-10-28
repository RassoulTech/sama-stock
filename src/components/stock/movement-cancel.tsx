"use client";

import { Undo2 } from "lucide-react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { cancelPurchase, cancelStockMovement } from "@/server/actions/stock";

/**
 * « Annuler » sur une ligne de l'historique du stock : une entrée (tout l'achat, toutes ses lignes) ou une sortie /
 * perte saisie à la main.
 */
export function MovementCancelButton({
  kind,
  movementId,
  purchaseId,
  productName,
}: {
  kind: "purchase" | "movement";
  movementId: string;
  purchaseId: string | null;
  productName: string;
}) {
  const purchase = kind === "purchase";
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive">
          <Undo2 className="size-3.5" /> Annuler
        </Button>
      }
      title={purchase ? "Annuler cette entrée de stock ?" : "Annuler cette sortie ?"}
      description={
        purchase
          ? "Tous les produits de cette entrée ressortent du stock (pas seulement celui-ci) et le prix d'achat moyen est recalculé. La ligne reste visible, barrée."
          : `« ${productName} » revient en stock et, si c'était une perte, elle ne compte plus dans les rapports. La ligne reste visible, barrée.`
      }
      confirmLabel={purchase ? "Annuler l'entrée" : "Annuler la sortie"}
      cancelLabel="Garder"
      destructive
      successMessage={purchase ? "Entrée annulée, stock mis à jour" : "Sortie annulée, produit remis en stock"}
      action={purchase ? cancelPurchase.bind(null, purchaseId ?? "") : cancelStockMovement.bind(null, movementId)}
    />
  );
}

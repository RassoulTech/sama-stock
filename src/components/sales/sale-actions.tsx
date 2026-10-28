"use client";

import { Ellipsis, Eye, PencilLine, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { correctSaleHref } from "@/lib/domain/sales";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cancelSale, deleteSale } from "@/server/actions/sales";

interface SaleRef {
  id: string;
  number: string;
  /** Déjà encaissé : à rendre au client si la vente est annulée. */
  amountPaid: number;
}

type DialogProps = { sale: SaleRef; trigger?: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void };

function CancelDialog({ sale, trigger, open, onOpenChange }: DialogProps) {
  return (
    <ConfirmAction
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      title={`Annuler la vente ${sale.number} ?`}
      description={
        <span className="block space-y-2">
          <span className="block">
            Les produits reviennent en stock et la vente ne compte plus dans le chiffre d&apos;affaires. Elle reste visible,
            barrée, avec votre nom.
          </span>
          {sale.amountPaid > 0 && (
            <span className="block font-semibold text-foreground">À rendre au client : {formatFCFA(sale.amountPaid)}</span>
          )}
          <span className="block">Pour changer seulement une quantité, un prix ou le client, utilisez plutôt « Corriger la vente ».</span>
        </span>
      }
      confirmLabel="Annuler la vente"
      cancelLabel="Garder la vente"
      destructive
      successMessage="Vente annulée, stock remis à jour"
      action={cancelSale.bind(null, sale.id)}
    />
  );
}

function DeleteDialog({ sale, trigger, open, onOpenChange, redirectTo }: DialogProps & { redirectTo?: string }) {
  return (
    <ConfirmAction
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      title={`Supprimer la vente ${sale.number} ?`}
      description="Elle disparaîtra de la liste des ventes et de l'historique du stock. Le stock ne change pas : il a déjà été remis à l'annulation. C'est définitif."
      confirmLabel="Supprimer pour de bon"
      cancelLabel="Garder"
      destructive
      successMessage="Vente supprimée"
      action={deleteSale.bind(null, sale.id)}
      redirectTo={redirectTo}
    />
  );
}

/** Boutons de la page d'une vente. */
export function CancelSaleButton({ sale, className }: { sale: SaleRef; className?: string }) {
  return (
    <CancelDialog
      sale={sale}
      trigger={
        <Button
          variant="outline"
          className={cn("border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive", className)}
        >
          <XCircle /> Annuler la vente
        </Button>
      }
    />
  );
}

export function DeleteSaleButton({ sale, className }: { sale: SaleRef; className?: string }) {
  return (
    <DeleteDialog
      sale={sale}
      redirectTo="/ventes"
      trigger={
        <Button variant="destructive" className={className}>
          <Trash2 /> Supprimer pour de bon
        </Button>
      }
    />
  );
}

/** Menu « ⋯ » d'une ligne de la liste des ventes. */
export function SaleRowMenu({
  sale,
  cancelled,
  canCorrect,
  canCancel,
  canDelete,
}: {
  sale: SaleRef;
  cancelled: boolean;
  canCorrect: boolean;
  canCancel: boolean;
  canDelete: boolean;
}) {
  const [dialog, setDialog] = useState<"cancel" | "delete" | null>(null);
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions pour la vente ${sale.number}`} className="mr-1 shrink-0">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/ventes/${sale.id}`}>
              <Eye /> Voir le reçu
            </Link>
          </DropdownMenuItem>
          {!cancelled && canCorrect && (
            <DropdownMenuItem asChild>
              <Link href={correctSaleHref(sale.id)}>
                <PencilLine /> Corriger la vente
              </Link>
            </DropdownMenuItem>
          )}
          {!cancelled && canCancel && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
              <XCircle /> Annuler la vente
            </DropdownMenuItem>
          )}
          {cancelled && canDelete && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash2 /> Supprimer pour de bon
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CancelDialog sale={sale} open={dialog === "cancel"} onOpenChange={close} />
      <DeleteDialog sale={sale} open={dialog === "delete"} onOpenChange={close} />
    </>
  );
}

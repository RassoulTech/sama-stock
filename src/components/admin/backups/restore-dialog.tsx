"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ImpactLine } from "@/lib/backup/compare";
import { formatDateTime, formatNumber } from "@/lib/format";
import { restoreAdmin, restoreShop } from "@/server/actions/backups";

export interface RestoreTarget {
  path: string;
  type: "boutique" | "admin";
  name: string;
  savedAt: string;
}

/**
 * Confirmation d'une restauration : ce qui sera perdu, puis le nom de la boutique (ou ADMIN) à retaper.
 * Une copie de l'état actuel est faite juste avant : la restauration peut être annulée.
 */
export function RestoreDialog({
  target,
  lines,
  onClose,
}: {
  target: RestoreTarget | null;
  /** Comparaison aujourd'hui / après (boutique) ; null pendant le chargement ou pour l'admin. */
  lines: ImpactLine[] | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const expected = target?.type === "admin" ? "ADMIN" : (target?.name ?? "");
  const matches = typed.trim().toLowerCase() === expected.trim().toLowerCase() && expected !== "";

  function close() {
    setTyped("");
    onClose();
  }

  function confirm() {
    if (!target) return;
    start(async () => {
      const res = target.type === "admin" ? await restoreAdmin({ path: target.path, confirm: typed }) : await restoreShop({ path: target.path, confirmName: typed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Restauration faite. L'état d'avant est gardé dans une sauvegarde « Avant restauration ».");
      close();
      router.refresh();
    });
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && !pending && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target?.type === "admin" ? "Restaurer les données admin" : `Restaurer « ${target?.name ?? ""} »`}</DialogTitle>
          <DialogDescription>
            {target ? `Remettre dans l'état du ${formatDateTime(target.savedAt)}. ` : ""}
            {target?.type === "admin"
              ? "Licences, paiements de licences, notes et journal reviennent à cette date. Les boutiques ne sont pas touchées."
              : "Seule cette boutique change : les autres boutiques, sa licence et son adresse ne bougent pas."}
          </DialogDescription>
        </DialogHeader>

        {target?.type === "boutique" &&
          (lines === null ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="overflow-hidden rounded-xl border text-sm">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span />
                <span className="text-right">{"Aujourd'hui"}</span>
                <span className="text-right">Après</span>
                <span className="text-right">Écart</span>
              </div>
              {lines.map((l) => (
                <div key={l.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 border-t px-3 py-1.5">
                  <span>{l.label}</span>
                  <span className="text-right tabular-nums">{formatNumber(l.now)}</span>
                  <span className="text-right tabular-nums">{formatNumber(l.after)}</span>
                  <span className={`text-right font-medium tabular-nums ${l.diff < 0 ? "text-destructive" : l.diff > 0 ? "text-success" : "text-muted-foreground"}`}>
                    {l.diff > 0 ? `+${formatNumber(l.diff)}` : formatNumber(l.diff)}
                  </span>
                </div>
              ))}
            </div>
          ))}

        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          {target?.type === "admin"
            ? "Ce qui a été fait dans l'admin depuis cette date sera effacé (une copie de l'état actuel est faite juste avant)."
            : "Ce qui a été fait dans la boutique depuis cette date sera effacé, factures comprises : leurs numéros pourront être redonnés. Une copie de l'état actuel est faite juste avant."}
        </p>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">{target?.type === "admin" ? "Tapez ADMIN pour confirmer" : "Retapez le nom de la boutique pour confirmer"}</span>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={expected} autoComplete="off" />
        </label>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={close}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={!matches || pending} onClick={confirm}>
            {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restaurer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

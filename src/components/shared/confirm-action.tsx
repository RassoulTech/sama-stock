"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmationMatches } from "@/lib/domain/admin-delete";
import type { ActionResult } from "@/server/action";

/**
 * Bouton qui demande confirmation puis exécute une Server Action. Sans `trigger`, la fenêtre est ouverte de
 * l'extérieur (`open` / `onOpenChange`), par exemple depuis un menu.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  destructive = false,
  successMessage,
  action,
  redirectTo,
  open: controlledOpen,
  onOpenChange,
  confirmText,
}: {
  trigger?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  /** Bouton qui ferme sans rien faire (« Annuler » prête à confusion quand l'action est elle-même une annulation). */
  cancelLabel?: string;
  destructive?: boolean;
  successMessage: string;
  /** Reçoit le texte retapé quand `confirmText` est demandé (le serveur le revérifie). */
  action: (typed: string) => Promise<ActionResult<unknown>>;
  redirectTo?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Suppression définitive : il faut retaper ce texte (nom, e-mail, numéro) avant de pouvoir confirmer. */
  confirmText?: string;
}) {
  const router = useRouter();
  const [ownOpen, setOwnOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const open = controlledOpen ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (!next) setTyped("");
    (onOpenChange ?? setOwnOpen)(next);
  };
  const confirmed = confirmText === undefined || confirmationMatches(typed, confirmText);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmText !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm font-normal">
              Pour confirmer, tapez <span className="font-semibold break-all">{confirmText}</span>
            </Label>
            <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} disabled={pending} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending || !confirmed}
            onClick={() =>
              startTransition(async () => {
                // Le texte retapé n'est transmis que s'il était demandé (les autres actions gardent leurs paramètres)
                const res = confirmText === undefined ? await (action as () => Promise<ActionResult<unknown>>)() : await action(typed);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success(successMessage);
                setOpen(false);
                if (redirectTo) router.push(redirectTo);
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

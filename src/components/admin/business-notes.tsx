"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { adminAddNote, adminDeleteNote } from "@/server/actions/admin";

export interface NoteRow {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** Notes internes de l'équipe sur un commerce : appel passé, promesse de paiement, besoin particulier… */
export function BusinessNotes({ businessId, notes }: { businessId: string; notes: NoteRow[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const res = await adminAddNote(businessId, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody("");
      toast.success("Note ajoutée");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ex. : appelé le 20/10, paiera en espèces vendredi."
          rows={3}
          maxLength={1000}
          aria-label="Nouvelle note interne"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Visible seulement par les administrateurs.</p>
          <Button size="sm" disabled={pending || body.trim().length < 2} onClick={add}>
            {pending && <Loader2 className="animate-spin" />}
            Ajouter la note
          </Button>
        </div>
      </div>
      {notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="whitespace-pre-line">{n.body}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {n.authorName} · {formatDateTime(n.createdAt)}
                </span>
                <ConfirmAction
                  trigger={
                    <button type="button" className="rounded p-1 hover:bg-muted hover:text-destructive" aria-label="Supprimer la note">
                      <Trash2 className="size-3.5" />
                    </button>
                  }
                  title="Supprimer cette note ?"
                  description="Elle disparaîtra pour toute l'équipe."
                  confirmLabel="Supprimer"
                  destructive
                  successMessage="Note supprimée"
                  action={() => adminDeleteNote(n.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

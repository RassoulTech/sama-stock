"use client";

import { DatabaseBackup, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { backupNow } from "@/server/actions/backups";

/** « Sauvegarder maintenant », par exemple avant une opération risquée. */
export function BackupNow() {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await backupNow();
          if (!res.ok) toast.error(res.error);
          else if (res.data.state === "ok") toast.success(`Sauvegarde faite : ${res.data.files} fichiers`);
          else toast.error(`Sauvegarde incomplète : ${res.data.errors} erreur(s). Une alerte de panne a été enregistrée.`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <DatabaseBackup />} {pending ? "Sauvegarde en cours…" : "Sauvegarder maintenant"}
    </Button>
  );
}

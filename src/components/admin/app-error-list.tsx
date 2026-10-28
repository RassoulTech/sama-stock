"use client";

import { CheckCircle2, DatabaseBackup, Globe, Server } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { resolveAppError } from "@/server/actions/admin-alerts";

export interface AppErrorRow {
  id: string;
  source: string;
  route: string;
  message: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

const SOURCES = {
  serveur: { label: "Serveur", icon: Server },
  navigateur: { label: "Téléphone ou ordinateur", icon: Globe },
  sauvegarde: { label: "Sauvegarde", icon: DatabaseBackup },
} as const;

/** Liste des pannes : non réglées en rouge, avec le bouton « Réglée ». */
export function AppErrorList({ errors }: { errors: AppErrorRow[] }) {
  const [pending, start] = useTransition();
  if (errors.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border bg-muted/30 p-5 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-success" /> Aucune panne enregistrée.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {errors.map((e) => {
        const source = SOURCES[e.source as keyof typeof SOURCES] ?? SOURCES.serveur;
        return (
          <li key={e.id} className={`rounded-xl border p-4 ${e.resolvedAt ? "opacity-60" : "border-destructive/40 bg-destructive/5"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <source.icon className="size-3.5" /> {source.label} · <span className="font-mono break-all">{e.route}</span>
                </p>
                <p className="text-sm font-medium break-words">{e.message}</p>
                <p className="text-xs text-muted-foreground">
                  {e.count} fois · 1re fois {formatDateTime(e.firstSeenAt)} · dernière fois {formatDateTime(e.lastSeenAt)}
                  {e.resolvedAt ? ` · réglée ${formatDateTime(e.resolvedAt)}` : ""}
                </p>
              </div>
              {!e.resolvedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await resolveAppError(e.id);
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Panne marquée comme réglée");
                    })
                  }
                >
                  <CheckCircle2 /> Réglée
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

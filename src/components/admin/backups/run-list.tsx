"use client";

import { ChevronDown, Download, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ImpactLine } from "@/lib/backup/compare";
import type { RunKind, RunState, RunSummary } from "@/lib/backup/format";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import { getRunFiles, previewShopRestore } from "@/server/actions/backups";
import { RestoreDialog, type RestoreTarget } from "./restore-dialog";

interface FileRow {
  type: "boutique" | "admin";
  name: string;
  path: string;
  bytes: number;
  counts: Record<string, number>;
  reused: boolean;
}

const KINDS: Record<RunKind, string> = { nuit: "Nuit", manuelle: "Manuelle", "avant-restauration": "Avant restauration" };
const STATES: Record<RunState, { label: string; tone: string }> = {
  ok: { label: "Réussie", tone: "bg-success/10 text-success" },
  partiel: { label: "Incomplète", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  echec: { label: "Ratée", tone: "bg-destructive/10 text-destructive" },
};

/** Liste des sauvegardes ; dépliée, chaque fichier avec « Télécharger » et « Restaurer ». */
export function RunList({ runs }: { runs: RunSummary[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, FileRow[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [target, setTarget] = useState<RestoreTarget | null>(null);
  const [lines, setLines] = useState<ImpactLine[] | null>(null);

  async function toggle(runId: string) {
    if (open === runId) {
      setOpen(null);
      return;
    }
    setOpen(runId);
    if (files[runId]) return;
    setLoading(runId);
    const res = await getRunFiles(runId);
    setLoading(null);
    if (!res.ok) toast.error(res.error);
    else setFiles((f) => ({ ...f, [runId]: res.data }));
  }

  async function askRestore(file: FileRow, savedAt: string) {
    setLines(null);
    setTarget({ path: file.path, type: file.type, name: file.name, savedAt });
    if (file.type !== "boutique") return;
    const res = await previewShopRestore(file.path);
    if (!res.ok) {
      toast.error(res.error);
      setTarget(null);
    } else setLines(res.data.lines);
  }

  if (runs.length === 0) {
    return <p className="rounded-xl border bg-muted/30 p-5 text-sm text-muted-foreground">Aucune sauvegarde pour le moment. La première se fera cette nuit, ou maintenant avec le bouton en haut.</p>;
  }

  return (
    <>
      <ul className="divide-y rounded-xl border">
        {runs.map((r) => {
          const state = STATES[r.state];
          return (
            <li key={r.runId}>
              <button type="button" onClick={() => void toggle(r.runId)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-muted/40">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{formatDateTime(r.startedAt)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {KINDS[r.kind]} · {r.shops} boutique{r.shops > 1 ? "s" : ""} · {r.bytes > 0 ? `${formatBytes(r.bytes)} écrits` : "rien de nouveau"}
                  </span>
                </span>
                {r.githubAt && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-success" /> Copie GitHub
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${state.tone}`}>{state.label}</span>
                {loading === r.runId ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className={`size-4 transition-transform ${open === r.runId ? "rotate-180" : ""}`} />}
              </button>
              {open === r.runId && files[r.runId] && (
                <ul className="space-y-2 bg-muted/20 px-4 py-3">
                  {files[r.runId]!.map((f) => (
                    <li key={f.path} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-background px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{f.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {f.type === "boutique"
                            ? `${formatNumber(f.counts.sales ?? 0)} ventes · ${formatNumber(f.counts.products ?? 0)} produits · ${formatNumber(f.counts.customers ?? 0)} clients`
                            : `${formatNumber(f.counts.licenseSales ?? 0)} licences · ${formatNumber(f.counts.adminAuditLog ?? 0)} lignes de journal`}
                          {" · "}
                          {formatBytes(f.bytes)}
                          {f.reused ? " · identique à la sauvegarde d'avant" : ""}
                        </span>
                      </span>
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/api/admin/sauvegardes/fichier?chemin=${encodeURIComponent(f.path)}`} download>
                          <Download /> Télécharger
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void askRestore(f, r.startedAt)}>
                        <RotateCcw /> Restaurer
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <RestoreDialog target={target} lines={lines} onClose={() => setTarget(null)} />
    </>
  );
}

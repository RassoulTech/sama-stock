import { DatabaseBackup, HardDrive, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { BackupNow } from "@/components/admin/backups/backup-now";
import { RunList } from "@/components/admin/backups/run-list";
import { PageHeader } from "@/components/shared/page-header";
import { formatBytes, formatDateTime } from "@/lib/format";
import { readIndex } from "@/server/backup/runs";
import { backupStore } from "@/server/backup/store";

export const metadata: Metadata = { title: "Sauvegardes" };
// Sauvegarder ou restaurer peut prendre du temps (actions de la page)
export const maxDuration = 300;

const STATE_TEXT = { ok: "réussie", partiel: "incomplète", echec: "ratée" } as const;

function Tile({ icon: Icon, label, value, hint, alert = false }: { icon: typeof DatabaseBackup; label: string; value: string; hint: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-4" /> {label}
      </p>
      <p className="mt-1.5 text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default async function AdminBackupsPage() {
  let ready = true;
  try {
    backupStore();
  } catch {
    ready = false;
  }
  const runs = ready ? await readIndex() : [];
  const last = runs[0];
  const lastNight = runs.find((r) => r.kind === "nuit");
  const github = runs.find((r) => r.githubAt);
  const used = runs.reduce((s, r) => s + r.bytes, 0);

  return (
    <>
      <PageHeader
        title="Sauvegardes"
        description="Chaque nuit, une sauvegarde complète : une par boutique, une pour l'admin. Gardée 30 jours, et une par mois pendant un an. Copie de secours chiffrée chez GitHub."
        actions={ready ? <BackupNow /> : undefined}
      />
      {!ready ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Le coffre des sauvegardes n&apos;est pas encore créé dans Vercel (Storage › Blob, accès privé, relié au projet).
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile
              icon={DatabaseBackup}
              label="Dernière sauvegarde"
              value={last ? formatDateTime(last.startedAt) : "Aucune"}
              hint={last ? `${STATE_TEXT[last.state]} · ${lastNight ? `nuit du ${formatDateTime(lastNight.startedAt)}` : "pas encore de nuit"}` : "La première se fera cette nuit"}
              alert={last?.state === "echec"}
            />
            <Tile
              icon={ShieldCheck}
              label="Copie de secours GitHub"
              value={github?.githubAt ? formatDateTime(github.githubAt) : "Jamais"}
              hint="Chiffrée : seule votre clé de secours l'ouvre"
            />
            <Tile icon={HardDrive} label="Place utilisée" value={formatBytes(used)} hint={`${runs.length} sauvegarde${runs.length > 1 ? "s" : ""} gardée${runs.length > 1 ? "s" : ""}`} />
          </div>
          <RunList runs={runs} />
        </div>
      )}
    </>
  );
}

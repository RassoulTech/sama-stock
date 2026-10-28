import { Cpu, DatabaseBackup, HardDrive } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Progress } from "@/components/ui/progress";
import { NEON_FREE_STORAGE_BYTES, storageLevel, TABLE_LABELS } from "@/lib/domain/platform";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import { readIndex } from "@/server/backup/runs";
import { databaseUsage } from "@/server/services/housekeeping";

export const metadata: Metadata = { title: "Santé de la plateforme" };

const LEVEL = {
  ok: { text: "Tout va bien", tone: "text-success", bar: "" },
  attention: { text: "À surveiller : prévoir l'offre payante de Neon", tone: "text-amber-700 dark:text-amber-400", bar: "[&>div]:bg-amber-500" },
  urgent: { text: "Urgent : passer Neon à l'offre payante", tone: "text-destructive", bar: "[&>div]:bg-destructive" },
} as const;

export default async function PlatformHealthPage() {
  const [usage, runs] = await Promise.all([databaseUsage(), readIndex().catch(() => [])]);
  const level = LEVEL[storageLevel(usage.bytes)];
  const pct = Math.min(100, (usage.bytes / NEON_FREE_STORAGE_BYTES) * 100);
  const vault = runs.reduce((s, r) => s + r.bytes, 0);

  return (
    <>
      <PageHeader
        title="Santé de la plateforme"
        description="La place prise par vos données et les limites des offres gratuites. Une alerte vous prévient à 70 % puis à 90 %."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border p-5 lg:col-span-2">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <HardDrive className="size-4" /> Place dans la base de données
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatBytes(usage.bytes)} <span className="text-base font-normal text-muted-foreground">sur 1 Go (offre gratuite de Neon)</span>
          </p>
          <Progress value={pct} className={`mt-3 h-2.5 ${level.bar}`} />
          <p className={`mt-2 text-sm font-medium ${level.tone}`}>
            {pct.toFixed(1).replace(".", ",")} % · {level.text}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Une vente prend environ 3 Ko : 1 Go correspond à environ 330 000 ventes (par exemple 20 boutiques à 50 ventes par jour pendant près d&apos;un an).
          </p>
        </section>

        <section className="rounded-xl border p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <DatabaseBackup className="size-4" /> Coffre des sauvegardes
          </p>
          <p className="mt-2 text-2xl font-semibold">{formatBytes(vault)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {runs.length} sauvegarde{runs.length > 1 ? "s" : ""} gardée{runs.length > 1 ? "s" : ""}
            {runs[0] ? ` · dernière le ${formatDateTime(runs[0].startedAt)}` : ""}
          </p>
        </section>

        <section className="rounded-xl border p-5 lg:col-span-3">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Cpu className="size-4" /> Temps de calcul de la base (Neon)
          </p>
          <p className="mt-2 text-sm">
            L&apos;offre gratuite donne <strong>100 heures de calcul par mois</strong>. La base s&apos;éteint quand personne ne s&apos;en sert et se rallume
            toute seule. Quand les boutiques travailleront toute la journée, tous les jours (à partir d&apos;environ 5 à 10 boutiques très actives), il faudra
            passer à l&apos;offre payante de Neon, sinon la base s&apos;arrêterait en fin de mois.
          </p>
          <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            Voir le temps utilisé ce mois-ci dans Neon (Usage)
          </a>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border">
        <p className="bg-muted/40 px-4 py-2.5 text-sm font-semibold">Ce qui prend le plus de place</p>
        <ul className="divide-y text-sm">
          {usage.tables.map((t) => (
            <li key={t.name} className="flex items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1 truncate">{TABLE_LABELS[t.name] ?? t.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(t.rows)} lignes</span>
              <span className="w-20 text-right font-medium tabular-nums">{formatBytes(t.bytes)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

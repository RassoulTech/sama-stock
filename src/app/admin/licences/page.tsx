import { BadgeCheck, Coins, FileText, HandCoins, Plus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminStat } from "@/components/admin/admin-stat";
import { ContactButtons } from "@/components/admin/contact-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { isLicensePack, LICENSE_ORDER, LICENSE_PACKS } from "@/lib/domain/plans";
import { formatDate, formatFCFA, formatNumber } from "@/lib/format";
import { pageSlice, readPage } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { balanceOf, licenseSummary, listLicenseSales, type LicenseSaleRow } from "@/server/queries/licences";

export const metadata: Metadata = { title: "Licences" };

const VIEWS = {
  tous: "Toutes",
  "a-encaisser": "À encaisser",
  maintenance: "Maintenance à renouveler",
  soldees: "Soldées",
  annulees: "Annulées",
} as const;
type View = keyof typeof VIEWS;

const packLabel = (p: string) => (isLicensePack(p) ? LICENSE_PACKS[p].label : p);

function maintenanceState(s: LicenseSaleRow) {
  if (!s.maintenance_ends_at) return { text: "—", tone: "gray" as const };
  const days = Math.ceil((new Date(s.maintenance_ends_at).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return { text: `Terminée le ${formatDate(s.maintenance_ends_at)}`, tone: "red" as const };
  if (days <= 30) return { text: `Finit dans ${days} j`, tone: "saffron" as const };
  return { text: `Jusqu'au ${formatDate(s.maintenance_ends_at)}`, tone: "green" as const };
}

function reminder(s: LicenseSaleRow) {
  const first = s.owner_name ? ` ${s.owner_name.split(" ")[0]}` : "";
  const rest = balanceOf(s);
  if (rest > 0) {
    return `Bonjour${first},\nPetit rappel pour votre application *${s.business}* (Sama Stock) : il reste *${formatFCFA(rest)}* à régler sur la licence ${s.number}. Vous pouvez payer par Wave, Orange Money ou en espèces.\nMerci et bonne journée !\nL'équipe Sama Stock`;
  }
  return `Bonjour${first},\nLa maintenance de votre application *${s.business}* (assistance, nouveautés, sauvegardes) arrive à échéance. Pour la prolonger d'un an : ${formatFCFA(s.maintenance_price)}.\nVotre application reste à vous dans tous les cas.\nL'équipe Sama Stock`;
}

export default async function AdminLicensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sales, params] = await Promise.all([listLicenseSales(), searchParams]);
  const sum = licenseSummary(sales);
  const view: View = typeof params.vue === "string" && params.vue in VIEWS ? (params.vue as View) : "tous";
  const due = new Set([...sum.maintenanceSoon, ...sum.maintenanceOver].map((s) => s.id));
  const matching = sales.filter((s) => {
    if (view === "annulees") return s.status !== "active";
    if (s.status !== "active") return view === "tous";
    if (view === "a-encaisser") return balanceOf(s) > 0;
    if (view === "maintenance") return due.has(s.id);
    if (view === "soldees") return balanceOf(s) === 0;
    return true;
  });
  const page = readPage(params);
  const { limit, offset } = pageSlice(page);
  const shown = matching.slice(offset, offset + limit);
  const count = (v: View) =>
    v === "tous"
      ? sales.length
      : v === "annulees"
        ? sales.filter((s) => s.status !== "active").length
        : v === "a-encaisser"
          ? sum.toCollect.length
          : v === "maintenance"
            ? due.size
            : sales.filter((s) => s.status === "active" && balanceOf(s) === 0).length;

  return (
    <>
      <PageHeader
        title="Licences"
        description="L'application vendue une fois, installée et personnalisée chez le client."
        actions={
          <Button asChild>
            <Link href="/admin/licences/nouveau">
              <Plus /> Nouveau client
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <AdminStat index={0} label="Licences actives" value={sum.count} icon={BadgeCheck} />
        <AdminStat index={1} label="Montant vendu" value={sum.sold} unit="FCFA" icon={Coins} hint="Prix convenus des licences actives" />
        <AdminStat index={2} label="Encaissé" value={sum.collected} unit="FCFA" icon={Wallet} tone="blue" hint="Licences et maintenances" />
        <AdminStat
          index={3}
          label="Reste à encaisser"
          value={sum.due}
          unit="FCFA"
          icon={HandCoins}
          tone={sum.due > 0 ? "saffron" : "slate"}
          hint={`${sum.toCollect.length} client${sum.toCollect.length > 1 ? "s" : ""} à relancer`}
          href="/admin/licences?vue=a-encaisser"
        />
      </div>

      <section className="mt-5 rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Vos forfaits (prix catalogue, négociables)</p>
        <div className="grid grid-cols-3 gap-2">
          {LICENSE_ORDER.map((id) => {
            const p = LICENSE_PACKS[id];
            return (
              <div key={id} className="rounded-lg bg-muted/50 p-2.5 sm:p-3">
                <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
                <p className="num text-[0.8125rem] font-semibold whitespace-nowrap sm:text-lg">{formatFCFA(p.price)}</p>
                <p className="text-[11px] text-muted-foreground">
                  puis {formatNumber(p.maintenancePrice)}
                  <span className="hidden sm:inline"> FCFA</span> / an
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <nav className="scroll-row -mx-1 mt-5 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filtrer les licences">
        {(Object.entries(VIEWS) as [View, string][]).map(([v, label]) => (
          <Link
            key={v}
            href={v === "tous" ? "/admin/licences" : `/admin/licences?vue=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground",
              view === v && "border-primary/30 bg-accent text-accent-foreground",
            )}
          >
            {label}
            <span className="num rounded-full bg-muted px-1.5 text-xs">{count(v)}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={sales.length === 0 ? "Aucune licence vendue pour l'instant" : "Rien dans cette liste"}
          description={sales.length === 0 ? "Après une démonstration réussie, enregistrez le client ici : son application est prête en deux minutes." : undefined}
          action={
            sales.length === 0 && (
              <Button asChild>
                <Link href="/admin/licences/nouveau">
                  <Plus /> Nouveau client
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {shown.map((s) => {
            const rest = balanceOf(s);
            const paidPct = s.agreed_price > 0 ? Math.min(100, Math.round((s.paid_licence / s.agreed_price) * 100)) : 100;
            const m = maintenanceState(s);
            const cancelled = s.status !== "active";
            return (
              <li key={s.id} className={cn("rounded-xl border bg-card p-4", cancelled && "opacity-60")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link href={`/admin/commerces/${s.business_id}`} className="min-w-0 flex-1 hover:text-primary">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {s.business}
                      <StatusPill tone="green">Licence {packLabel(s.pack)}</StatusPill>
                      {cancelled && <StatusPill tone="red">Annulée</StatusPill>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.number} · {[s.owner_name, s.city].filter(Boolean).join(" · ")} · vendue le {formatDate(s.created_at)}
                    </span>
                  </Link>
                  <span className="flex items-center gap-1.5">
                    {!cancelled && (rest > 0 || due.has(s.id)) && <ContactButtons compact phone={s.phone} email={null} message={reminder(s)} />}
                    <Button asChild variant="outline" size="sm" aria-label="Facture">
                      <Link href={`/documents/licence/${s.id}?type=facture`}>
                        <FileText />
                        <span className="hidden sm:inline">Facture</span>
                      </Link>
                    </Button>
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <div>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Payé <span className="num font-semibold text-foreground">{formatFCFA(s.paid_licence)}</span> sur {formatFCFA(s.agreed_price)}
                      </span>
                      <span className={cn("num font-semibold", rest > 0 ? "text-warning dark:text-saffron" : "text-success")}>
                        {rest > 0 ? `Reste ${formatFCFA(rest)}` : "Soldée"}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", rest > 0 ? "bg-saffron" : "bg-primary")} style={{ width: `${paidPct}%` }} />
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Maintenance · </span>
                    <StatusPill tone={m.tone}>{m.text}</StatusPill>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination path="/admin/licences" params={params} page={page} total={matching.length} />
    </>
  );
}

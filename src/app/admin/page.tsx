import { Activity, ArrowDownRight, ArrowUpRight, Download, ShoppingBag, Store, TriangleAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuditList } from "@/components/admin/audit-list";
import { BarChart } from "@/components/admin/bar-chart";
import { Funnel, HealthPill } from "@/components/admin/contact-buttons";
import { AdminStat, compareTrend } from "@/components/admin/admin-stat";
import { TodoList } from "@/components/admin/todo-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_STATUS_TONES } from "@/lib/domain/plans";
import { formatDate, formatFCFA, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { activationFunnel, adminStats, listAllBusinesses, listAudit, platformOverview, todoLists } from "@/server/queries/admin";
import { openAppErrorCount } from "@/server/queries/app-errors";
import { licenseSummary, listLicenseSales } from "@/server/queries/licences";

export const metadata: Metadata = { title: { absolute: "Tableau de bord · Administration" } };

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const TODAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar" });

export default async function AdminDashboardPage() {
  const [rows, overview, audit, sales, openErrors] = await Promise.all([
    listAllBusinesses(),
    platformOverview(),
    listAudit({ limit: 6 }),
    listLicenseSales(),
    openAppErrorCount(),
  ]);
  const lic = licenseSummary(sales);
  const stats = adminStats(rows);
  const c = overview.counts;
  const todo = todoLists(rows);
  const funnel = activationFunnel(rows);
  const paidEver = funnel.at(-1)!.count;
  const conversion = stats.total > 0 ? Math.round((paidEver / stats.total) * 100) : 0;
  const latest = rows.slice(0, 5);
  const todoCount =
    Object.values(todo).reduce((s, l) => s + l.length, 0) + lic.toCollect.length + lic.maintenanceSoon.length + lic.maintenanceOver.length + lic.followUps.length;

  const signups = overview.signups.map((d, i) => ({
    key: d.day,
    label: DAY.format(new Date(`${d.day}T00:00:00Z`)),
    value: d.n,
    // Une date par semaine, sans chevaucher la dernière
    tick:
      (i % 7 === 0 && i < overview.signups.length - 4) || i === overview.signups.length - 1
        ? DAY.format(new Date(`${d.day}T00:00:00Z`))
        : undefined,
  }));
  const revenue = overview.revenue.map((m) => {
    const label = MONTH.format(new Date(`${m.month}-01T00:00:00Z`));
    return { key: m.month, label, value: m.total, tick: label };
  });
  const today = TODAY.format(new Date());

  const revenueTrend = compareTrend(c.revenue_month, c.revenue_prev, "vs mois dernier", { format: (n) => formatNumber(n) });

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`${today.charAt(0).toUpperCase()}${today.slice(1)} · vue d'ensemble de la plateforme`}
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/export/commerces" download>
              <Download /> Exporter les commerces
            </a>
          </Button>
        }
      />

      {openErrors > 0 && (
        <Link
          href="/admin/pannes"
          className="mb-5 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
        >
          <TriangleAlert className="size-4" /> {openErrors} panne{openErrors > 1 ? "s" : ""} à regarder
        </Link>
      )}

      {/* Argent du mois en tête, avec les ventes de licences, la conversion et les essais */}
      <section
        aria-label="Ventes de licences"
        className="relative mb-4 overflow-hidden rounded-[1.75rem] p-5 text-white shadow-[0_22px_44px_-24px_var(--sidebar)] sm:p-6"
        style={{ backgroundImage: "linear-gradient(150deg, var(--sidebar) 0%, color-mix(in oklab, var(--sidebar) 70%, black) 100%)" }}
      >
        <div aria-hidden className="absolute -top-24 -right-16 size-64 rounded-full bg-white/[0.07]" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium opacity-80">Encaissé ce mois</p>
            <p className="amount mt-1 text-[2.25rem] leading-none font-bold sm:text-[2.75rem]">{formatFCFA(c.revenue_month)}</p>
          </div>
          {revenueTrend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                revenueTrend.good ? "bg-white/15 text-white" : "bg-saffron/25 text-saffron",
              )}
            >
              {revenueTrend.up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {revenueTrend.text}
            </span>
          )}
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-white/10">
          <Link href="/admin/licences" className="bg-white/[0.04] px-3 py-3 transition-colors hover:bg-white/10 sm:px-4">
            <p className="text-xs opacity-75">Licences vendues</p>
            <p className="amount mt-0.5 text-xl font-bold">{lic.count}</p>
            <p className={cn("mt-0.5 text-[11px] leading-snug", lic.due > 0 ? "font-semibold text-saffron" : "opacity-70")}>
              {lic.due > 0 ? `${formatFCFA(lic.due)} dus` : `${formatFCFA(lic.collected)} reçus`}
            </p>
          </Link>
          <div className="bg-white/[0.04] px-3 py-3 sm:px-4">
            <p className="text-xs opacity-75">Conversion</p>
            <p className="amount mt-0.5 text-xl font-bold">{conversion} %</p>
            <p className="mt-0.5 text-[11px] leading-snug opacity-70">des inscrits</p>
          </div>
          <Link href="/admin/commerces?statut=trialing" className="bg-white/[0.04] px-3 py-3 transition-colors hover:bg-white/10 sm:px-4">
            <p className="text-xs opacity-75">Essais en cours</p>
            <p className="amount mt-0.5 text-xl font-bold">{stats.trialing}</p>
            <p className={cn("mt-0.5 text-[11px] leading-snug", todo.trialsEnding.length > 0 ? "font-semibold text-saffron" : "opacity-70")}>
              {todo.trialsEnding.length > 0 ? `${todo.trialsEnding.length} à 3 j de la fin` : `${stats.expired} terminé${stats.expired > 1 ? "s" : ""}`}
            </p>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <AdminStat
          index={0}
          label="Commerces inscrits"
          value={stats.total}
          hint={`${c.signups_month} ce mois · ${stats.trialing} en essai`}
          trend={compareTrend(c.signups_month, c.signups_prev, "vs mois dernier")}
          icon={Store}
          href="/admin/commerces"
        />
        <AdminStat
          index={1}
          label="En activité (7 j)"
          value={stats.alive7}
          hint={`sur ${stats.total} · une vente ou du stock`}
          icon={Activity}
          tone="blue"
          href="/admin/commerces?activite=active"
        />
        <AdminStat
          index={2}
          label="Vendu par les commerçants"
          value={c.gmv30}
          unit="FCFA"
          hint={`${formatNumber(c.sales30)} ventes en 30 jours`}
          icon={ShoppingBag}
          tone="slate"
        />
        <AdminStat
          index={3}
          label="Utilisateurs"
          value={c.users}
          hint={`${c.active_users7} actif${c.active_users7 > 1 ? "s" : ""} (7 j) · ${c.orphan_users} sans commerce`}
          icon={UserRound}
          tone="slate"
          href="/admin/utilisateurs"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              À faire aujourd&apos;hui
              {todoCount > 0 && <span className="num rounded-full bg-saffron px-2 text-xs font-bold text-saffron-foreground">{todoCount}</span>}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Les commerçants à relancer ou à accompagner, avec WhatsApp en un geste.</p>
          </CardHeader>
          <CardContent>
            <TodoList todo={todo} licences={lic} />
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Parcours des commerçants</CardTitle>
              <p className="text-sm text-muted-foreground">De l&apos;inscription au premier paiement.</p>
            </CardHeader>
            <CardContent>
              <Funnel steps={funnel} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="font-semibold">Dernières actions de l&apos;équipe</CardTitle>
              <Link href="/admin/journal" className="text-xs font-medium text-primary hover:underline">
                Tout le journal
              </Link>
            </CardHeader>
            <CardContent>
              <AuditList entries={audit} compact />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Nouveaux commerces (30 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={signups} format={(n) => `${n} inscription${n > 1 ? "s" : ""}`} label="Inscriptions de commerces par jour" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Argent encaissé (6 derniers mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={revenue} format={formatFCFA} label="Licences et maintenance encaissées par mois (Wave, Orange Money, espèces)" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="font-semibold">Derniers commerces inscrits</CardTitle>
          <Link href="/admin/commerces" className="text-xs font-medium text-primary hover:underline">
            Tous les commerces
          </Link>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {latest.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/commerces/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[r.ownerName, r.city].filter(Boolean).join(" · ") || "—"} · inscrit le {formatDate(r.createdAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                    <HealthPill health={r.health} />
                    <StatusPill tone={PLAN_STATUS_TONES[r.state.status]}>{r.state.label}</StatusPill>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

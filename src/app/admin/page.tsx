import { CalendarClock, Coins, CreditCard, MonitorSmartphone, ReceiptText, Store, TrendingUp, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart } from "@/components/admin/bar-chart";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/stock-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES } from "@/lib/domain/plans";
import { formatDate, formatFCFA, formatNumber } from "@/lib/format";
import { adminStats, endingSoon, listAllBusinesses, platformOverview } from "@/server/queries/admin";

export const metadata: Metadata = { title: { absolute: "Tableau de bord · Administration" } };

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function AdminDashboardPage() {
  const [rows, overview] = await Promise.all([listAllBusinesses(), platformOverview()]);
  const stats = adminStats(rows);
  const c = overview.counts;
  const soon = endingSoon(rows, 7);
  const latest = rows.slice(0, 5);

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

  return (
    <>
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de la plateforme Sama Stock." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Commerces" value={stats.total} hint={`${stats.trialing} en essai gratuit`} icon={Store} href="/admin/commerces" />
        <StatCard
          label="Abonnés payants"
          value={stats.active}
          hint={`${stats.expired} expiré${stats.expired > 1 ? "s" : ""} · ${stats.suspended} suspendu${stats.suspended > 1 ? "s" : ""}`}
          icon={CreditCard}
          href="/admin/abonnements"
        />
        <StatCard
          label="Encaissé ce mois"
          value={formatFCFA(c.revenue_month)}
          hint={`Mois dernier : ${formatFCFA(c.revenue_prev)}`}
          icon={Coins}
          href="/admin/paiements"
        />
        <StatCard
          label="Revenu mensuel récurrent"
          value={formatFCFA(stats.mrr)}
          hint="Abonnements payants en cours"
          icon={TrendingUp}
          tone="neutral"
        />
        <StatCard
          label="Utilisateurs"
          value={formatNumber(c.users)}
          hint={`${c.google_users} avec Google · ${c.active_users7} actifs (7 j)`}
          icon={UserRound}
          href="/admin/utilisateurs"
        />
        <StatCard
          label="Connexions actives"
          value={formatNumber(c.active_sessions)}
          hint="Sessions ouvertes en ce moment"
          icon={MonitorSmartphone}
          href="/admin/connexions"
          tone="neutral"
        />
        <StatCard
          label="Ventes (30 jours)"
          value={formatNumber(c.sales30)}
          hint={`${formatNumber(c.products)} produits suivis`}
          icon={ReceiptText}
          tone="neutral"
        />
        <StatCard
          label="Paiements en attente"
          value={c.pending_checkouts}
          hint="Paiements en ligne non confirmés (48 h)"
          icon={CalendarClock}
          href="/admin/paiements"
          tone={c.pending_checkouts > 0 ? "saffron" : "neutral"}
        />
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
            <BarChart data={revenue} format={formatFCFA} label="Abonnements encaissés par mois (Wave, Orange Money, espèces)" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">À surveiller : fin d&apos;essai ou d&apos;abonnement sous 7 jours</CardTitle>
          </CardHeader>
          <CardContent>
            {soon.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune échéance dans les 7 prochains jours.</p>
            ) : (
              <ul className="divide-y text-sm">
                {soon.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/admin/commerces/${r.id}`} className="min-w-0 truncate font-medium hover:underline">
                      {r.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <StatusPill tone={PLAN_STATUS_TONES[r.state.status]}>{r.state.label}</StatusPill>
                      fin le {formatDate(r.state.endsAt!)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Derniers commerces inscrits</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {latest.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <Link href={`/admin/commerces/${r.id}`} className="block truncate font-medium hover:underline">
                      {r.name}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.ownerName ?? "—"} · inscrit le {formatDate(r.createdAt)}
                    </span>
                  </span>
                  <StatusPill tone={PLAN_STATUS_TONES[r.state.status]}>{PLAN_STATUS_LABELS[r.state.status]}</StatusPill>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

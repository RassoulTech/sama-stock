import { CalendarClock, Percent, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminStat } from "@/components/admin/admin-stat";
import { ContactButtons } from "@/components/admin/contact-buttons";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminReminderMessage } from "@/lib/domain/admin";
import { PLAN_STATUS_TONES, PLANS, type PlanId } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { activationFunnel, adminStats, endingSoon, listAllBusinesses, type AdminBusinessRow } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Abonnements" };

const message = (r: AdminBusinessRow) =>
  adminReminderMessage({ ownerName: r.ownerName, businessName: r.name, status: r.state.status, daysLeft: r.state.daysLeft });

function Row({ r, detail }: { r: AdminBusinessRow; detail: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link href={`/admin/commerces/${r.id}`} className="min-w-0 flex-1 hover:text-primary">
        <span className="block truncate text-sm font-medium">{r.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </Link>
      <ContactButtons compact phone={r.phone} email={r.ownerEmail} message={message(r)} />
    </li>
  );
}

export default async function AdminSubscriptionsPage() {
  const rows = await listAllBusinesses();
  const stats = adminStats(rows);
  // Abonnements en ligne seulement (les licences ont leur propre page)
  const live = rows.filter((r) => !r.state.license && (r.state.status === "active" || r.state.status === "trialing"));
  const plans = (["trial", "pro", "business"] as PlanId[]).map((id) => {
    const count = live.filter((r) => r.state.plan === id).length;
    return { plan: PLANS[id], count, monthly: id === "trial" ? 0 : count * PLANS[id].price };
  });
  const soon = endingSoon(rows, 14);
  const expired = rows.filter((r) => r.state.status === "expired").sort((a, b) => (b.state.endsAt?.getTime() ?? 0) - (a.state.endsAt?.getTime() ?? 0));
  const paidEver = activationFunnel(rows).at(-1)!.count;
  const conversion = stats.total > 0 ? Math.round((paidEver / stats.total) * 100) : 0;
  // Clients déjà payants dont l'abonnement n'est plus actif
  const lost = rows.filter((r) => r.paidTotal > 0 && r.state.status === "expired").length;

  return (
    <>
      <PageHeader title="Abonnements" description="Revenu, répartition par formule, échéances à venir et comptes à relancer." />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <AdminStat index={0} label="Revenu mensuel récurrent" value={stats.mrr} unit="FCFA" icon={TrendingUp} hint={`${stats.active} abonné${stats.active > 1 ? "s" : ""} payant${stats.active > 1 ? "s" : ""}`} />
        <AdminStat index={1} label="Taux de conversion" value={conversion} unit="%" icon={Percent} tone="blue" hint="Inscrits devenus payants" />
        <AdminStat index={2} label="Échéances (14 j)" value={soon.length} icon={CalendarClock} tone={soon.length > 0 ? "saffron" : "slate"} hint="Essais et abonnements" />
        <AdminStat index={3} label="Clients perdus" value={lost} icon={TrendingDown} tone={lost > 0 ? "red" : "slate"} hint="Ont payé, abonnement expiré" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
        {plans.map(({ plan, count, monthly }) => (
          <div key={plan.id} className={cn("rounded-xl border bg-card p-3.5 sm:p-5", plan.id === "business" && "ring-2 ring-primary/25")}>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                <span className="hidden sm:inline">Formule </span>
                {plan.label}
              </p>
              <p className="text-[11px] text-muted-foreground sm:text-xs">{plan.id === "trial" ? "gratuit" : `${formatFCFA(plan.price)} / mois`}</p>
            </div>
            <p className="num mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{count}</p>
            <p className="text-xs text-muted-foreground sm:text-sm">en cours</p>
            <p className="mt-2 border-t pt-2 text-xs sm:mt-3 sm:pt-3 sm:text-sm">
              {plan.id === "trial" ? (
                <span className="text-muted-foreground">Futurs clients</span>
              ) : (
                <>
                  <span className="num font-semibold">{formatFCFA(monthly)}</span>
                  <span className="text-muted-foreground"> / mois</span>
                </>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <CalendarClock className="size-4 text-primary" /> Échéances des 14 prochains jours
            </CardTitle>
            <p className="text-sm text-muted-foreground">Prévenez avant la fin : un message suffit souvent.</p>
          </CardHeader>
          <CardContent>
            {soon.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune échéance proche.</p>
            ) : (
              <ul className="divide-y">
                {soon.map((r) => (
                  <Row
                    key={r.id}
                    r={r}
                    detail={
                      <>
                        <StatusPill tone={PLAN_STATUS_TONES[r.state.status]} className="mr-1.5 align-middle">
                          {r.state.label}
                        </StatusPill>
                        fin le {formatDate(r.state.endsAt!)} ({r.state.daysLeft <= 0 ? "aujourd'hui" : `${r.state.daysLeft} j`})
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <RotateCcw className="size-4 text-warning dark:text-saffron" /> Comptes expirés ({expired.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">Leurs données sont gardées : un renouvellement les rouvre aussitôt.</p>
          </CardHeader>
          <CardContent>
            {expired.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun compte expiré.</p>
            ) : (
              <ul className="divide-y">
                {expired.map((r) => (
                  <Row
                    key={r.id}
                    r={r}
                    detail={
                      <>
                        {r.state.label} · expiré le {r.state.endsAt ? formatDate(r.state.endsAt) : "—"}
                        {r.paidTotal > 0 && <> · a déjà payé {formatFCFA(r.paidTotal)}</>}
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

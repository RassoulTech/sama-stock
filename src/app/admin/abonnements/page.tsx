import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES, PLANS, type PlanId } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { endingSoon, listAllBusinesses } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Abonnements" };

export default async function AdminSubscriptionsPage() {
  const rows = await listAllBusinesses();
  const live = rows.filter((r) => r.state.status === "active" || r.state.status === "trialing");
  const plans = (["trial", "pro", "business"] as PlanId[]).map((id) => {
    const count = live.filter((r) => r.state.plan === id).length;
    return { plan: PLANS[id], count, monthly: id === "trial" ? 0 : count * PLANS[id].price };
  });
  const soon = endingSoon(rows, 14);
  const expired = rows.filter((r) => r.state.status === "expired");

  return (
    <>
      <PageHeader title="Abonnements" description="Répartition par formule, échéances à venir et comptes expirés." />

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map(({ plan, count, monthly }) => (
          <div key={plan.id} className={cn("surface p-5", plan.id === "business" && "ring-2 ring-primary/30")}>
            <p className="text-sm font-medium text-muted-foreground">Formule {plan.label}</p>
            <p className="mt-2 text-3xl font-semibold">{count}</p>
            <p className="text-sm text-muted-foreground">
              commerce{count > 1 ? "s" : ""} en cours · {plan.id === "trial" ? "gratuit" : `${formatFCFA(plan.price)} / mois`}
            </p>
            {plan.id !== "trial" && (
              <p className="mt-3 border-t pt-3 text-sm">
                Rapporte <span className="num font-semibold">{formatFCFA(monthly)}</span> par mois
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <CalendarClock className="size-4 text-primary" /> Échéances des 14 prochains jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {soon.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune échéance proche.</p>
            ) : (
              <ul className="divide-y text-sm">
                {soon.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/admin/commerces/${r.id}`} className="min-w-0 truncate font-medium hover:underline">
                      {r.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <StatusPill tone={PLAN_STATUS_TONES[r.state.status]}>{r.state.label}</StatusPill>
                      {formatDate(r.state.endsAt!)} ({r.state.daysLeft} j)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Comptes expirés ({expired.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {expired.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun compte expiré.</p>
            ) : (
              <ul className="divide-y text-sm">
                {expired.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <Link href={`/admin/commerces/${r.id}`} className="block truncate font-medium hover:underline">
                        {r.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.ownerEmail ?? "—"} {r.phone && <>· {r.phone}</>}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {PLAN_STATUS_LABELS[r.state.status]} {r.state.endsAt && <>le {formatDate(r.state.endsAt)}</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

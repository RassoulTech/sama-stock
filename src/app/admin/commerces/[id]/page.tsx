import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminActions } from "@/components/admin/admin-actions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatFCFA, formatPhone } from "@/lib/format";
import { isRole, ROLE_LABELS } from "@/lib/domain/permissions";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES, PLANS } from "@/lib/domain/plans";
import { ACTIVITIES, type Activity } from "@/lib/domain/sales";
import { getBusinessForAdmin } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Commerce · Administration" };

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBusinessForAdmin(id);
  if (!data) notFound();
  const { business: b, history, members } = data;

  return (
    <>
      <PageHeader
        backHref="/admin"
        title={b.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={PLAN_STATUS_TONES[b.state.status]}>
              {b.state.label} · {PLAN_STATUS_LABELS[b.state.status]}
            </StatusPill>
            {ACTIVITIES[b.activity as Activity] ?? b.activity}
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-semibold">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminActions businessId={b.id} plan={b.state.plan} suspended={b.state.status === "suspended"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {[
                ["Propriétaire", `${b.ownerName ?? "—"} (${b.ownerEmail ?? "—"})`],
                ["Téléphone", b.phone ? formatPhone(b.phone) : "—"],
                ["Ville", b.city ?? "—"],
                ["Inscrit le", formatDate(b.createdAt)],
                ["Fin de période", b.state.endsAt ? formatDate(b.state.endsAt) : "—"],
                ["Produits", String(b.productCount)],
                ["Ventes (30 j)", String(b.sales30)],
                ["Dernière activité", b.lastActivity ? formatDate(b.lastActivity) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Membres ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {members.map((m) => (
                <li key={m.email} className="flex justify-between gap-3">
                  <span className="truncate">
                    {m.name} <span className="text-muted-foreground">· {m.email}</span>
                  </span>
                  <span className="font-medium">{isRole(m.role) ? ROLE_LABELS[m.role] : m.role}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-semibold">Historique d&apos;abonnement</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun événement.</p>
            ) : (
              <ul className="divide-y text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex justify-between gap-3 py-2.5">
                    <span>
                      {PLANS[h.plan as keyof typeof PLANS]?.label ?? h.plan} · {h.method}
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(h.createdAt)} → fin le {h.periodEnd ? formatDate(h.periodEnd) : "—"}
                        {h.note && <> · {h.note}</>}
                      </span>
                    </span>
                    <span className="num font-semibold">{formatFCFA(h.amount)}</span>
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

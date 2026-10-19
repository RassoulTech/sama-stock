import { Banknote, Coins, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { StatCard } from "@/components/shared/stat-card";
import { StatusPill } from "@/components/shared/stock-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS } from "@/lib/domain/plans";
import { formatDate, formatDateTime, formatFCFA } from "@/lib/format";
import { listPayments, SUBSCRIPTION_METHOD_LABELS } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Paiements" };

const CHECKOUT_STATUS: Record<string, { label: string; tone: "green" | "saffron" | "red" }> = {
  paid: { label: "Payé", tone: "green" },
  pending: { label: "En attente", tone: "saffron" },
  failed: { label: "Échoué ou annulé", tone: "red" },
};

const planLabel = (p: string) => PLANS[p as keyof typeof PLANS]?.label ?? p;

export default async function AdminPaymentsPage() {
  const { events, checkouts, totals } = await listPayments();
  const sum = (method: string, key: "month" | "total") => totals.find((t) => t.method === method)?.[key] ?? 0;
  const month = sum("saspay", "month") + sum("especes", "month");
  const total = sum("saspay", "total") + sum("especes", "total");

  return (
    <>
      <PageHeader
        title="Paiements"
        description="Tout l'argent encaissé pour les abonnements : Wave et Orange Money (via SasPay) et espèces."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Encaissé ce mois" value={formatFCFA(month)} icon={Coins} />
        <StatCard label="Total encaissé" value={formatFCFA(total)} icon={Wallet} tone="neutral" />
        <StatCard label="Wave / Orange Money" value={formatFCFA(sum("saspay", "total"))} hint="Montant payé par les clients" icon={Wallet} tone="neutral" />
        <StatCard label="Espèces" value={formatFCFA(sum("especes", "total"))} icon={Banknote} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Historique des abonnements</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun paiement pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="min-w-0">
                    <Link href={`/admin/commerces/${e.business_id}`} className="font-medium hover:underline">
                      {e.business}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(e.created_at)} · Formule {planLabel(e.plan)}
                      {e.period_end && <> jusqu&apos;au {formatDate(e.period_end)}</>}
                      {e.note && <> · {e.note}</>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      {e.method === "saspay" && (
                        <span className="flex -space-x-1">
                          <PaymentLogo method="wave" className="size-4 ring-2 ring-card" />
                          <PaymentLogo method="orange_money" className="size-4 ring-2 ring-card" />
                        </span>
                      )}
                      {e.method === "especes" && <Banknote className="size-4" />}
                      {SUBSCRIPTION_METHOD_LABELS[e.method] ?? e.method}
                    </span>
                    <span className="num w-28 text-right font-semibold">{formatFCFA(e.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="font-semibold">Paiements en ligne (SasPay)</CardTitle>
        </CardHeader>
        <CardContent>
          {checkouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun paiement en ligne pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y text-sm">
              {checkouts.map((c) => {
                const status = CHECKOUT_STATUS[c.status] ?? { label: c.status, tone: "saffron" as const };
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <Link href={`/admin/commerces/${c.business_id}`} className="block truncate font-medium hover:underline">
                        {c.business}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(c.created_at)} · Formule {planLabel(c.plan)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      <span className="num w-24 text-right font-semibold">{formatFCFA(c.amount)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

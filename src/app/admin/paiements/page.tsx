import { Banknote, Coins, Download, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminStat } from "@/components/admin/admin-stat";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS } from "@/lib/domain/plans";
import { formatDate, formatDateTime, formatFCFA } from "@/lib/format";
import { pageSlice, readPage } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { listPayments, SUBSCRIPTION_METHOD_LABELS } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Paiements" };

const CHECKOUT_STATUS: Record<string, { label: string; tone: "green" | "saffron" | "red" }> = {
  paid: { label: "Payé", tone: "green" },
  pending: { label: "En attente", tone: "saffron" },
  failed: { label: "Échoué ou annulé", tone: "red" },
};

const FILTERS = [
  { value: "tous", label: "Tous" },
  { value: "saspay", label: "Wave / Orange Money" },
  { value: "especes", label: "Espèces" },
  { value: "admin", label: "Ajustements" },
] as const;

const planLabel = (p: string) => PLANS[p as keyof typeof PLANS]?.label ?? p;

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ events, checkouts, totals }, params] = await Promise.all([listPayments(), searchParams]);
  const methode = FILTERS.some((f) => f.value === params.methode) ? (params.methode as string) : "tous";
  const matching = methode === "tous" ? events : events.filter((e) => e.method === methode);
  const page = readPage(params);
  const { limit, offset } = pageSlice(page);
  const shown = matching.slice(offset, offset + limit);
  const sum = (method: string, key: "month" | "total") => totals.find((t) => t.method === method)?.[key] ?? 0;
  const month = sum("saspay", "month") + sum("especes", "month");
  const total = sum("saspay", "total") + sum("especes", "total");
  const pending = checkouts.filter((c) => c.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Paiements"
        description="L'argent encaissé pour les abonnements : Wave et Orange Money (via SasPay) et espèces."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/export/paiements" download>
              <Download /> Exporter (Excel)
            </a>
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <AdminStat index={0} label="Encaissé ce mois" value={month} unit="FCFA" icon={Coins} />
        <AdminStat index={1} label="Total encaissé" value={total} unit="FCFA" icon={Wallet} />
        <AdminStat index={2} label="Wave / Orange Money" value={sum("saspay", "total")} unit="FCFA" hint={`${totals.find((t) => t.method === "saspay")?.count ?? 0} paiements`} icon={Wallet} tone="blue" />
        <AdminStat index={3} label="Espèces" value={sum("especes", "total")} unit="FCFA" hint={`${totals.find((t) => t.method === "especes")?.count ?? 0} paiements`} icon={Banknote} tone="saffron" />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="font-semibold">Historique des abonnements</CardTitle>
          <nav className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Filtrer par moyen de paiement">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={f.value === "tous" ? "/admin/paiements" : `/admin/paiements?methode=${f.value}`}
                aria-current={methode === f.value ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground",
                  methode === f.value && "border-primary/30 bg-accent text-accent-foreground",
                )}
              >
                {f.label}
                <span className="num rounded-full bg-muted px-1.5 text-xs">
                  {f.value === "tous" ? events.length : events.filter((e) => e.method === f.value).length}
                </span>
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun paiement pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y text-sm">
              {shown.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-3 sm:items-center">
                  <span className="min-w-0">
                    <Link href={`/admin/commerces/${e.business_id}`} className="font-medium hover:text-primary hover:underline">
                      {e.business}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(e.created_at)} · {planLabel(e.plan)}
                      {e.period_end && <> jusqu&apos;au {formatDate(e.period_end)}</>}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      {e.method === "saspay" && (
                        <span className="flex -space-x-1">
                          <PaymentLogo method="wave" className="size-4 ring-2 ring-card" />
                          <PaymentLogo method="orange_money" className="size-4 ring-2 ring-card" />
                        </span>
                      )}
                      {e.method === "especes" && <Banknote className="size-4" />}
                      {SUBSCRIPTION_METHOD_LABELS[e.method] ?? e.method}
                      {e.note && <span className="hidden sm:inline"> · {e.note}</span>}
                    </span>
                  </span>
                  <span className={cn("num shrink-0 text-right font-semibold", e.amount === 0 && "text-muted-foreground")}>{formatFCFA(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <Pagination path="/admin/paiements" params={params} page={page} total={matching.length} />
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-semibold">
            Paiements en ligne (SasPay)
            {pending > 0 && <span className="num rounded-full bg-saffron px-2 text-xs font-bold text-saffron-foreground">{pending} en attente</span>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Chaque tentative de paiement Wave ou Orange Money, confirmée ou non.</p>
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
                      <Link href={`/admin/commerces/${c.business_id}`} className="block truncate font-medium hover:text-primary hover:underline">
                        {c.business}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(c.created_at)} · {planLabel(c.plan)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      <span className="num font-semibold sm:w-24 sm:text-right">{formatFCFA(c.amount)}</span>
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

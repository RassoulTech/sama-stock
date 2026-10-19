import { BarChart3, Lock, PackageMinus, Percent, ShieldAlert, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { RevenueProfitChart } from "@/components/charts/revenue-charts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatFCFA, formatQty } from "@/lib/format";
import { REASON_LABELS } from "@/lib/domain/stock";
import { CHANNELS, PAYMENT_METHODS, type Channel, type PaymentMethod } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { breakdown, dailySeries, dormantProducts, losses, salesSummary, topProducts } from "@/server/queries/analytics";
import { periodStart } from "@/server/queries/sales";

export const metadata: Metadata = { title: "Rapports" };

const REPORT_PERIODS = { "7j": { label: "7 jours", days: 7 }, "30j": { label: "30 jours", days: 30 }, "90j": { label: "90 jours", days: 90 } } as const;
type ReportPeriod = keyof typeof REPORT_PERIODS;

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext("reports.view");

  if (!ctx.plan.limits.advancedReports) {
    return (
      <>
        <PageHeader title="Rapports" />
        <Card className="mx-auto max-w-xl text-center">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <span className="grid size-14 place-items-center rounded-2xl bg-accent text-primary">
              <Lock className="size-7" />
            </span>
            <h2 className="text-xl font-extrabold">Les rapports avancés sont inclus dans Pro et Business</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Évolution de vos ventes et de votre bénéfice, meilleurs produits, produits qui dorment, ventes par canal et par
              mode de paiement, pertes… tout pour piloter votre commerce.
            </p>
            {ctx.can("billing.manage") && (
              <Button asChild size="lg">
                <Link href="/abonnement">Voir les formules</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  const params = await searchParams;
  const period = (typeof params.periode === "string" && params.periode in REPORT_PERIODS ? params.periode : "30j") as ReportPeriod;
  const days = REPORT_PERIODS[period].days;
  const from = periodStart(period);

  const [summary, series, top, channels, methods, dormant, lossRows] = await Promise.all([
    salesSummary(ctx, from),
    dailySeries(ctx, from, days),
    topProducts(ctx, from),
    breakdown(ctx, from, "channel"),
    breakdown(ctx, from, "paymentMethod"),
    dormantProducts(ctx, 30),
    losses(ctx, from),
  ]);
  const margin = summary.revenue > 0 ? Math.round((summary.profit / summary.revenue) * 100) : 0;
  const lossTotal = lossRows.reduce((s, l) => s + l.value, 0);

  return (
    <>
      <PageHeader
        title="Rapports"
        description="Chiffres hors frais de livraison, ventes validées et commandes livrées."
        actions={
          <div className="flex gap-2">
            {(Object.entries(REPORT_PERIODS) as [ReportPeriod, { label: string }][]).map(([key, p]) => (
              <Link
                key={key}
                href={`/rapports?periode=${key}`}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground",
                  period === key && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires" value={formatFCFA(summary.revenue)} icon={Wallet} hint={`${summary.count} ventes`} />
        <StatCard label="Bénéfice brut" value={formatFCFA(summary.profit)} icon={TrendingUp} tone={summary.profit < 0 ? "danger" : "primary"} />
        <StatCard label="Marge moyenne" value={`${margin} %`} icon={Percent} tone="neutral" />
        <StatCard
          label="Pertes"
          value={formatFCFA(lossTotal)}
          icon={ShieldAlert}
          tone={lossTotal > 0 ? "danger" : "neutral"}
          hint="Casse, vol, péremption, écarts d'inventaire"
        />
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="font-bold">Évolution des ventes et du bénéfice</CardTitle>
          <p className="text-sm text-muted-foreground">Par jour, en FCFA · {REPORT_PERIODS[period].label}</p>
        </CardHeader>
        <CardContent>
          {summary.count === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente sur cette période.</p>
          ) : (
            <RevenueProfitChart data={series} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-bold">
              <ShoppingBag className="size-4 text-primary" /> Meilleures ventes
            </CardTitle>
            <p className="text-sm text-muted-foreground">Par chiffre d&apos;affaires</p>
          </CardHeader>
          <CardContent>
            <BarList
              items={top.byRevenue.map((p) => ({ label: p.name, value: p.revenue, hint: formatQty(p.quantity, p.unit) }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-bold">
              <TrendingUp className="size-4 text-primary" /> Produits les plus rentables
            </CardTitle>
            <p className="text-sm text-muted-foreground">Par bénéfice</p>
          </CardHeader>
          <CardContent>
            <BarList items={top.byProfit.filter((p) => p.profit > 0).map((p) => ({ label: p.name, value: p.profit }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-bold">Ventes par canal</CardTitle>
            <p className="text-sm text-muted-foreground">Boutique, WhatsApp, Instagram…</p>
          </CardHeader>
          <CardContent>
            <BarList
              items={channels.map((c) => ({
                label: CHANNELS[c.key as Channel] ?? c.key,
                value: c.revenue,
                hint: `${c.count} vente${c.count > 1 ? "s" : ""}`,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-bold">Ventes par mode de paiement</CardTitle>
            <p className="text-sm text-muted-foreground">Mode choisi au moment de la vente</p>
          </CardHeader>
          <CardContent>
            <BarList
              items={methods.map((m) => ({
                label: m.key === "inconnu" ? "Non payé" : (PAYMENT_METHODS[m.key as PaymentMethod] ?? m.key),
                value: m.revenue,
                hint: `${m.count}`,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-bold">
              <PackageMinus className="size-4 text-warning dark:text-saffron" /> Produits qui dorment
            </CardTitle>
            <p className="text-sm text-muted-foreground">En stock, mais aucune vente depuis 30 jours</p>
          </CardHeader>
          <CardContent>
            {dormant.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun produit dormant. Votre stock tourne bien.</p>
            ) : (
              <ul className="divide-y">
                {dormant.map((d) => (
                  <li key={d.id}>
                    <Link href={`/produits/${d.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{d.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatQty(d.quantity, d.unit)} · {d.last_sale ? `dernière vente le ${formatDate(d.last_sale)}` : "jamais vendu"}
                        </span>
                      </span>
                      <span className="num font-semibold">{formatFCFA(d.value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-bold">
              <ShieldAlert className="size-4 text-destructive" /> Pertes enregistrées
            </CardTitle>
            <p className="text-sm text-muted-foreground">Valorisées au prix d&apos;achat</p>
          </CardHeader>
          <CardContent>
            <BarList
              emptyText="Aucune perte sur cette période."
              items={lossRows.map((l) => ({
                label: REASON_LABELS[l.reason] ?? l.reason,
                value: l.value,
                hint: `${l.count} fois`,
              }))}
            />
          </CardContent>
        </Card>
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <BarChart3 className="size-3.5" /> Les chiffres sont recalculés à chaque visite.
      </p>
    </>
  );
}

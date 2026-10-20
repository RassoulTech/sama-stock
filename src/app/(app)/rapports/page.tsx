import { BarChart3, Lock, PackageMinus, Percent, ShieldAlert, ShoppingBag, Tags, TrendingUp, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { RevenueProfitChart } from "@/components/charts/revenue-charts";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePeriod, type PeriodPreset, type SearchParams } from "@/lib/filters";
import { formatDate, formatFCFA, formatQty } from "@/lib/format";
import { REASON_LABELS } from "@/lib/domain/stock";
import { CHANNELS, PAYMENT_METHODS, type Channel, type PaymentMethod } from "@/lib/domain/sales";
import { requireContext } from "@/server/context";
import {
  breakdown,
  categoryBreakdown,
  dailySeries,
  dormantProducts,
  losses,
  salesSummary,
  topProducts,
} from "@/server/queries/analytics";

export const metadata: Metadata = { title: "Rapports" };

const PRESETS: PeriodPreset[] = ["7j", "30j", "mois", "mois-dernier", "90j"];

export default async function RapportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireContext("reports.view");

  if (!ctx.plan.limits.advancedReports) {
    return (
      <>
        <PageHeader title="Rapports" />
        <Card className="mx-auto max-w-xl text-center">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <span className="grid size-14 place-items-center rounded-xl bg-accent text-primary">
              <Lock className="size-7" />
            </span>
            <h2 className="text-xl font-semibold">Les rapports avancés sont inclus dans Pro et Business</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Évolution de vos ventes et de votre bénéfice, ventes par catégorie de produits, meilleurs produits, produits
              qui dorment, ventes par canal et par mode de paiement, pertes… tout pour piloter votre commerce.
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
  const period = resolvePeriod(params, { fallback: "30j", allowed: PRESETS });
  // Toutes les périodes proposées ici ont un début et une fin
  const from = period.from!;
  const to = period.to!;
  const days = period.days ?? 30;

  const [summary, series, top, categories, channels, methods, dormant, lossRows] = await Promise.all([
    salesSummary(ctx, from, { to }),
    dailySeries(ctx, from, days),
    topProducts(ctx, from, 8, to),
    categoryBreakdown(ctx, from, to),
    breakdown(ctx, from, "channel", to),
    breakdown(ctx, from, "paymentMethod", to),
    dormantProducts(ctx, 30),
    losses(ctx, from, to),
  ]);
  const margin = summary.revenue > 0 ? Math.round((summary.profit / summary.revenue) * 100) : 0;
  const lossTotal = lossRows.reduce((s, l) => s + l.value, 0);

  // Lien vers les ventes de la catégorie, sur la même période
  const periodQuery = period.key === "dates" ? `periode=dates&du=${period.du}&au=${period.au}` : `periode=${period.key}`;
  const categorySalesHref = (categoryId: string | null) =>
    categoryId && ctx.business.modulePos ? `/ventes?${periodQuery}&categorie=${categoryId}` : undefined;

  return (
    <>
      <PageHeader title="Rapports" description="Chiffres hors frais de livraison, ventes validées et commandes livrées." />

      <FilterBar
        period={{ value: period.key, presets: PRESETS, fallback: "30j", du: period.du, au: period.au, customLabel: period.label }}
        resultLabel={period.label}
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
          <CardTitle className="font-semibold">Évolution des ventes et du bénéfice</CardTitle>
          <p className="text-sm text-muted-foreground">Par jour, en FCFA · {period.label}</p>
        </CardHeader>
        <CardContent>
          {summary.count === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente sur cette période.</p>
          ) : (
            <RevenueProfitChart data={series} />
          )}
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <Tags className="size-4 text-primary" /> Ventes par catégorie
            </CardTitle>
            <p className="text-sm text-muted-foreground">Chiffre d&apos;affaires, part du total et bénéfice de chaque catégorie</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/categories">Gérer les catégories</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune vente sur cette période.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <BarList
                items={categories.map((c) => ({
                  label: c.name,
                  value: c.revenue,
                  hint: `${c.share.toLocaleString("fr-FR")} %`,
                  href: categorySalesHref(c.categoryId),
                }))}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Catégorie</th>
                      <th className="py-2 pr-3 text-right font-medium">Ventes</th>
                      <th className="py-2 pr-3 text-right font-medium">Bénéfice</th>
                      <th className="py-2 text-right font-medium">Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.categoryId ?? "aucune"} className="border-b last:border-0">
                        <td className="max-w-40 truncate py-2 pr-3 font-medium">{c.name}</td>
                        <td className="num py-2 pr-3 text-right">{c.saleCount}</td>
                        <td className={`num py-2 pr-3 text-right font-semibold ${c.profit < 0 ? "text-destructive" : ""}`}>
                          {formatFCFA(c.profit)}
                        </td>
                        <td className="num py-2 text-right text-muted-foreground">
                          {c.revenue > 0 ? `${Math.round((c.profit / c.revenue) * 100)} %` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <ShoppingBag className="size-4 text-primary" /> Meilleures ventes
            </CardTitle>
            <p className="text-sm text-muted-foreground">Par chiffre d&apos;affaires</p>
          </CardHeader>
          <CardContent>
            <BarList
              items={top.byRevenue.map((p) => ({
                label: p.name,
                value: p.revenue,
                hint: formatQty(p.quantity, p.unit),
                href: p.productId ? `/produits/${p.productId}` : undefined,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <TrendingUp className="size-4 text-primary" /> Produits les plus rentables
            </CardTitle>
            <p className="text-sm text-muted-foreground">Par bénéfice</p>
          </CardHeader>
          <CardContent>
            <BarList
              items={top.byProfit
                .filter((p) => p.profit > 0)
                .map((p) => ({ label: p.name, value: p.profit, href: p.productId ? `/produits/${p.productId}` : undefined }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Ventes par canal</CardTitle>
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
            <CardTitle className="font-semibold">Ventes par mode de paiement</CardTitle>
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
            <CardTitle className="flex items-center gap-2 font-semibold">
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
            <CardTitle className="flex items-center gap-2 font-semibold">
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

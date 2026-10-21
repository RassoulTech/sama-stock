import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Bike,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  HandCoins,
  Package,
  Plus,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { WeekRevenueBars } from "@/components/charts/revenue-charts";
import { ProductThumb } from "@/components/products/product-thumb";
import { PaymentStatus, SaleStatus } from "@/components/sales/sale-status";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StockBadge } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatFCFA, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { dailySeries, recentSales, salesSummary, stockValue } from "@/server/queries/analytics";
import { totalCustomerDebt } from "@/server/queries/customers";
import { listOrders } from "@/server/queries/orders";
import { listProducts } from "@/server/queries/products";
import { periodStart } from "@/server/queries/sales";
import { employeeCount } from "@/server/queries/team";

import { DemoGuide } from "@/components/demo/demo-guide";
import { DEMO_SPECS } from "@/server/demo/specs";

export const metadata: Metadata = { title: "Tableau de bord" };

const todayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Dakar" });

export default async function DashboardPage() {
  const ctx = await requireContext();
  const full = ctx.can("dashboard.full");
  const seller = ctx.can("sales.create") && !full;
  const showOrders = ctx.business.moduleOrders && ctx.can("orders.manage");
  const showPos = ctx.business.modulePos && ctx.can("sales.create");
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [products, today, week, month, series, debt, value, orders, recent, teamCount] = await Promise.all([
    listProducts(ctx),
    ctx.can("sales.create") || full ? salesSummary(ctx, periodStart("today"), { own: seller }) : null,
    full ? salesSummary(ctx, periodStart("7j")) : null,
    full ? salesSummary(ctx, monthStart) : null,
    full ? dailySeries(ctx, periodStart("7j"), 7) : null,
    full ? totalCustomerDebt(ctx.business.id) : null,
    ctx.can("costs.view") ? stockValue(ctx) : null,
    showOrders ? listOrders(ctx, "open") : null,
    showPos ? recentSales(ctx, { own: seller }) : null,
    ctx.can("team.manage") ? employeeCount(ctx.business.id) : null,
  ]);

  const alerts = products.filter((p) => p.status !== "ok").sort((a, b) => a.available - b.available);
  const firstName = ctx.user.name.split(" ")[0];
  const writable = !ctx.plan.readOnly;

  const checklist = ctx.role === "owner" && [
    { done: products.length > 0, label: "Ajouter un premier produit", href: "/produits/nouveau" },
    {
      done: Boolean(recent?.length || orders?.length),
      label: showPos ? "Faire une première vente" : "Enregistrer une première commande",
      href: showPos ? "/vendre" : "/commandes/nouvelle",
    },
    // Licence : l'étape n'apparaît que si son forfait permet des employés
    ...(ctx.plan.license
      ? ctx.plan.limits.maxEmployees !== 0
        ? [{ done: (teamCount ?? 0) > 0, label: "Inviter un employé", href: "/equipe" }]
        : []
      : [{ done: (teamCount ?? 0) > 0, label: "Inviter un employé (formules Pro et Business)", href: "/equipe" }]),
  ];
  const showChecklist = !ctx.business.isDemo && checklist && checklist.some((c) => !c.done) && products.length < 5;

  return (
    <>
      <PageHeader
        title={`Bonjour ${firstName} !`}
        description={
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            {todayLabel.format(now).replace(/^./, (c) => c.toUpperCase())}
          </span>
        }
        actions={
          writable && (
            <>
              {showPos && (
                <Button asChild variant="saffron">
                  <Link href="/vendre">
                    <ShoppingCart /> Vendre
                  </Link>
                </Button>
              )}
              {showOrders && (
                <Button asChild variant={showPos ? "outline" : "default"}>
                  <Link href="/commandes/nouvelle">
                    <Plus /> Commande
                  </Link>
                </Button>
              )}
              {ctx.can("stock.in") && (
                <Button asChild variant="outline">
                  <Link href="/stock/entree">
                    <ArrowDownToLine /> Entrée de stock
                  </Link>
                </Button>
              )}
            </>
          )
        }
      />

      {ctx.business.isDemo && (
        <DemoGuide plan={ctx.plan.plan} businessName={ctx.business.name} pitch={DEMO_SPECS[ctx.plan.plan].pitch} />
      )}

      {showChecklist && checklist && (
        <Card className="mb-6 overflow-hidden bg-gradient-to-br from-accent to-card">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-semibold">Pour bien démarrer</p>
              <p className="text-sm text-muted-foreground">
                {checklist.length === 2 ? "Deux" : "Trois"} étapes pour profiter pleinement de {ctx.plan.license ? "votre application" : "Sama Stock"}.
              </p>
            </div>
            <ol className={cn("grid flex-[2] gap-2", checklist.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link
                    href={c.href}
                    className={cn(
                      "flex h-full items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-sm font-medium border hover:ring-primary/40",
                      c.done && "text-muted-foreground line-through",
                    )}
                  >
                    {c.done ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}
                    {c.label}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {today && (
          <StatCard
            label={seller ? "Mes ventes du jour" : "Aujourd'hui"}
            value={formatFCFA(today.revenue)}
            hint={`${today.count} vente${today.count > 1 ? "s" : ""}`}
            icon={Wallet}
          />
        )}
        {week && (
          <StatCard
            label="7 derniers jours"
            value={formatFCFA(week.revenue)}
            hint={`${week.count} vente${week.count > 1 ? "s" : ""}`}
            icon={TrendingUp}
            tone="neutral"
          />
        )}
        {month && ctx.can("costs.view") && (
          <StatCard
            label="Bénéfice du mois"
            value={formatFCFA(month.profit)}
            hint={`Sur ${formatFCFA(month.revenue)} de ventes`}
            icon={TrendingUp}
            tone={month.profit < 0 ? "danger" : "primary"}
            href={ctx.can("reports.view") ? "/rapports" : undefined}
          />
        )}
        {debt && (
          <StatCard
            label="Crédits clients"
            value={formatFCFA(debt.debt)}
            hint={`${debt.debtors} client${debt.debtors > 1 ? "s" : ""} à relancer`}
            icon={HandCoins}
            tone={debt.debt > 0 ? "saffron" : "neutral"}
            href="/clients"
          />
        )}
        {!full && (
          <StatCard
            label="Alertes de stock"
            value={alerts.length}
            hint="Produits en stock bas ou en rupture"
            icon={AlertTriangle}
            tone={alerts.length > 0 ? "saffron" : "neutral"}
            href="/produits?etat=bas"
          />
        )}
        {showOrders && orders && !full && (
          <StatCard label="Commandes en cours" value={orders.length} icon={Bike} tone="neutral" href="/commandes" />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {series && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-semibold">Ventes des 7 derniers jours</CardTitle>
              <p className="text-sm text-muted-foreground">Chiffre d&apos;affaires par jour, en FCFA</p>
            </CardHeader>
            <CardContent>
              <WeekRevenueBars data={series} />
            </CardContent>
          </Card>
        )}

        <Card className={cn(!series && "lg:col-span-2")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-warning dark:text-saffron" /> Alertes de stock
            </CardTitle>
            {alerts.length > 0 && (
              <CardAction>
                <Link href="/produits?etat=bas" className="text-sm font-semibold text-primary hover:underline">
                  Tout voir
                </Link>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="size-8 text-success" />
                {products.length === 0 ? "Ajoutez des produits pour suivre votre stock." : "Tout est en stock. Rien à signaler."}
              </div>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link href={`/produits/${p.id}`} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-muted/60">
                      <ProductThumb name={p.name} imageUrl={p.imageUrl} className="size-9 rounded-lg text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="num text-xs text-muted-foreground">Reste {formatQty(p.available, p.unit)}</p>
                      </div>
                      <StockBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {alerts.length > 0 && ctx.can("stock.in") && writable && (
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/stock/entree">
                  <ArrowDownToLine /> Réapprovisionner
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {orders && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-semibold">
                <Bike className="size-4 text-primary" /> Commandes en cours
                <span className="num rounded-full bg-muted px-2 text-xs">{orders.length}</span>
              </CardTitle>
              <CardAction>
                <Link href="/commandes" className="text-sm font-semibold text-primary hover:underline">
                  Tout voir
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Aucune commande en attente.</p>
              ) : (
                <ul className="divide-y">
                  {orders.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <Link href={`/commandes/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {o.number} · {o.customerName}
                          </span>
                          <SaleStatus kind="order" status={o.status} />
                        </span>
                        <span className="num text-sm font-semibold">{formatFCFA(o.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {recent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-semibold">
                <ShoppingCart className="size-4 text-primary" /> {seller ? "Mes dernières ventes" : "Dernières ventes"}
              </CardTitle>
              <CardAction>
                <Link href="/ventes" className="text-sm font-semibold text-primary hover:underline">
                  Tout voir
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Aucune vente pour l&apos;instant.</p>
              ) : (
                <ul className="divide-y">
                  {recent.map((s) => (
                    <li key={s.id}>
                      <Link href={`/ventes/${s.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
                        <span>
                          <span className="block text-sm font-semibold">{s.number}</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</span>
                        </span>
                        <span className="flex flex-col items-end gap-0.5">
                          <span className="num text-sm font-semibold">{formatFCFA(s.total)}</span>
                          {s.amountPaid < s.total && <PaymentStatus total={s.total} amountPaid={s.amountPaid} />}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {value !== null && (
          <Card className="bg-primary text-primary-foreground ring-primary">
            <CardContent className="flex h-full flex-col justify-between gap-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium opacity-80">Valeur de votre stock</p>
                <Package className="size-5 opacity-80" />
              </div>
              <div>
                <p className="num text-3xl font-semibold tracking-tight">{formatFCFA(value)}</p>
                <p className="text-sm opacity-80">
                  {products.length} produit{products.length > 1 ? "s" : ""} · au prix d&apos;achat moyen
                </p>
              </div>
              <Link href="/stock" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                Voir le stock <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        )}

        {ctx.role === "storekeeper" && writable && (
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild variant="outline">
                <Link href="/stock/inventaire">
                  <ClipboardList /> Faire l&apos;inventaire
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/stock/sortie">
                  <AlertTriangle /> Déclarer une perte
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

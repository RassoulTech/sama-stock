import { Banknote, ChevronRight, CloudOff, HandCoins, Plus, ReceiptText, ShoppingBag, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SaleRowMenu } from "@/components/sales/sale-actions";
import { PaymentStatus, SaleStatus } from "@/components/sales/sale-status";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, type FilterSelect } from "@/components/shared/filter-bar";
import { isBrandedMethod, PaymentLogo } from "@/components/shared/payment-logo";
import { Pagination } from "@/components/shared/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { param, pickParam, resolvePeriod, type PeriodPreset, type SearchParams } from "@/lib/filters";
import { formatFCFA } from "@/lib/format";
import { pageSlice, readPage } from "@/lib/pagination";
import { PAYMENT_METHODS, SALE_METHODS, type PaymentMethod } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listCategories } from "@/server/queries/products";
import { listSales, listSellers, SALE_STATES, salesSummary, type SaleState } from "@/server/queries/sales";

export const metadata: Metadata = { title: "Ventes" };

const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" });
const DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Dakar" });
const DAY_KEY = new Intl.DateTimeFormat("fr-CA", { timeZone: "Africa/Dakar" });

/** Ventes regroupées par jour, dans l'ordre de la liste : « Aujourd'hui », « Hier », puis « lundi 2 novembre ». */
function groupByDay<T extends { createdAt: Date | string }>(rows: T[]) {
  const today = DAY_KEY.format(new Date());
  const yesterday = DAY_KEY.format(new Date(Date.now() - 86_400_000));
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const row of rows) {
    const key = DAY_KEY.format(new Date(row.createdAt));
    let group = groups.at(-1);
    if (group?.key !== key) {
      const label = key === today ? "Aujourd'hui" : key === yesterday ? "Hier" : DAY.format(new Date(row.createdAt));
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(row);
  }
  return groups;
}

/** Tuile du moyen de paiement : logo Wave / Orange Money, billets pour les espèces, main tendue pour le crédit. */
function MethodTile({ method, cancelled }: { method: string | null; cancelled: boolean }) {
  const label = method ? (PAYMENT_METHODS[method as PaymentMethod] ?? method) : "Vente";
  if (method && isBrandedMethod(method)) {
    return <PaymentLogo method={method} className={cn("size-10 rounded-xl ring-1 ring-border", cancelled && "opacity-50 grayscale")} />;
  }
  const Icon = method === "cash" ? Banknote : method === "credit" ? HandCoins : ReceiptText;
  return (
    <span
      title={label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl",
        cancelled
          ? "bg-muted text-muted-foreground"
          : method === "credit"
            ? "bg-saffron/15 text-warning dark:text-saffron"
            : "bg-accent text-primary",
      )}
    >
      <Icon className="size-[1.125rem]" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

const PRESETS: PeriodPreset[] = ["today", "yesterday", "7j", "30j", "mois", "mois-dernier", "90j"];

export default async function VentesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireContext("sales.create");
  const params = await searchParams;
  const own = !ctx.can("dashboard.full");
  const writable = !ctx.plan.readOnly;
  const canCancel = writable && ctx.can("sales.cancel");
  const canCorrect = canCancel && ctx.can("sales.create") && ctx.business.modulePos;
  const canDelete = writable && ctx.can("sales.delete");

  const period = resolvePeriod(params, { fallback: "today", allowed: PRESETS });
  const method = pickParam(params, "paiement", SALE_METHODS);
  const state = pickParam(params, "etat", Object.keys(SALE_STATES) as SaleState[]);
  const q = param(params, "q")?.slice(0, 60) ?? "";

  const [categories, sellers] = await Promise.all([listCategories(ctx.business.id), own ? [] : listSellers(ctx)]);
  const categoryId = pickParam(params, "categorie", categories.map((c) => c.id));
  const sellerId = pickParam(params, "vendeur", sellers.map((s) => s.id));

  const filters = { from: period.from, to: period.to, method, state, categoryId, sellerId, q };
  const page = readPage(params);
  const [sales, summary] = await Promise.all([listSales(ctx, filters, pageSlice(page)), salesSummary(ctx, filters)]);
  const { revenue, cashed } = summary;

  const selects: FilterSelect[] = [
    {
      name: "paiement",
      allLabel: "Tous les paiements",
      value: method,
      options: SALE_METHODS.map((m) => ({ value: m, label: PAYMENT_METHODS[m] })),
    },
    {
      name: "etat",
      allLabel: "Tous les états",
      value: state,
      options: Object.entries(SALE_STATES).map(([value, label]) => ({ value, label })),
    },
  ];
  if (categories.length > 0) {
    selects.push({
      name: "categorie",
      allLabel: "Toutes les catégories",
      value: categoryId,
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    });
  }
  if (sellers.length > 1) {
    selects.push({
      name: "vendeur",
      allLabel: "Tous les vendeurs",
      value: sellerId,
      options: sellers.map((s) => ({ value: s.id, label: s.name })),
    });
  }

  return (
    <>
      <PageHeader
        title={own ? "Mes ventes" : "Ventes"}
        description={`Ventes en caisse · ${ctx.location.name}`}
        actions={
          ctx.business.modulePos &&
          !ctx.plan.readOnly && (
            <Button asChild variant="saffron">
              <Link href="/vendre">
                <Plus /> Nouvelle vente
              </Link>
            </Button>
          )
        }
      />

      <FilterBar
        search={{ value: q, placeholder: "N° de vente ou nom du client…" }}
        selects={selects}
        period={{
          value: period.key,
          presets: PRESETS,
          fallback: "today",
          du: period.du,
          au: period.au,
          customLabel: period.label,
        }}
        resultLabel={`${summary.count} vente${summary.count > 1 ? "s" : ""} · ${period.label.toLowerCase()}`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Chiffre d'affaires" value={formatFCFA(revenue)} icon={Wallet} cible="ventes.total" />
        <StatCard label="Ventes validées" value={summary.valid} icon={ShoppingBag} tone="neutral" />
        <StatCard
          label="Encaissé"
          value={formatFCFA(cashed)}
          icon={ReceiptText}
          tone={cashed < revenue ? "saffron" : "primary"}
          hint={cashed < revenue ? `${formatFCFA(revenue - cashed)} à crédit` : undefined}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {sales.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Aucune vente ne correspond"
          description="Changez la période ou les filtres pour voir d'autres ventes."
        />
      ) : (
        <>
          <div className="space-y-5">
            {groupByDay(sales).map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h2 className="mb-2 flex items-baseline justify-between px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {group.label}
                  <span className="font-medium tracking-normal normal-case">
                    {group.items.length} vente{group.items.length > 1 ? "s" : ""}
                  </span>
                </h2>
                <ul className="surface divide-y overflow-hidden">
                  {group.items.map((s) => (
                    <li key={s.id} className="flex items-center transition-colors hover:bg-muted/50">
                      <Link href={`/ventes/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 pl-3.5">
                        <MethodTile method={s.paymentMethod} cancelled={s.status === "cancelled"} />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                            {s.number}
                            {s.status === "cancelled" && <SaleStatus kind="sale" status={s.status} />}
                            {s.offline && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                <CloudOff className="size-3" /> Hors ligne
                              </span>
                            )}
                            {s.flagged && (
                              <span className="rounded-md bg-saffron/15 px-1.5 py-0.5 text-[11px] font-medium text-warning dark:text-saffron">
                                À vérifier
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {TIME.format(new Date(s.createdAt))} · {s.itemCount} article{s.itemCount > 1 ? "s" : ""}
                            {s.customerName && <> · {s.customerName}</>}
                            {!own && s.sellerName && <> · {s.sellerName}</>}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                          <p className={cn("amount font-bold", s.status === "cancelled" && "text-muted-foreground line-through")}>
                            {formatFCFA(s.total)}
                          </p>
                          {s.status === "completed" && s.amountPaid < s.total && <PaymentStatus total={s.total} amountPaid={s.amountPaid} />}
                        </div>
                        {!(canCancel || canDelete) && <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />}
                      </Link>
                      {(canCancel || canDelete) && (
                        <SaleRowMenu
                          sale={{ id: s.id, number: s.number, amountPaid: s.amountPaid }}
                          cancelled={s.status === "cancelled"}
                          canCorrect={canCorrect}
                          canCancel={canCancel}
                          canDelete={canDelete}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Pagination path="/ventes" params={params} page={page} total={summary.count} />
        </>
      )}
    </>
  );
}

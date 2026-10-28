import { ChevronRight, CloudOff, Plus, ReceiptText, ShoppingBag, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SaleRowMenu } from "@/components/sales/sale-actions";
import { PaymentStatus, SaleStatus } from "@/components/sales/sale-status";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar, type FilterSelect } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { param, pickParam, resolvePeriod, type PeriodPreset, type SearchParams } from "@/lib/filters";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { pageSlice, readPage } from "@/lib/pagination";
import { PAYMENT_METHODS, SALE_METHODS, type PaymentMethod } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listCategories } from "@/server/queries/products";
import { listSales, listSellers, SALE_STATES, salesSummary, type SaleState } from "@/server/queries/sales";

export const metadata: Metadata = { title: "Ventes" };

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
        <StatCard label="Chiffre d'affaires" value={formatFCFA(revenue)} icon={Wallet} />
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
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {sales.map((s) => (
              <li key={s.id} className="flex items-center hover:bg-muted/50">
                <Link href={`/ventes/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
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
                      {formatDateTime(s.createdAt)} · {s.itemCount} article{s.itemCount > 1 ? "s" : ""}
                      {s.customerName && <> · {s.customerName}</>}
                      {!own && s.sellerName && <> · {s.sellerName}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("num font-semibold", s.status === "cancelled" && "text-muted-foreground line-through")}>
                      {formatFCFA(s.total)}
                    </p>
                    <div className="flex items-center justify-end gap-1.5">
                      {s.paymentMethod && s.amountPaid > 0 && (
                        <span className="text-xs text-muted-foreground">{PAYMENT_METHODS[s.paymentMethod as PaymentMethod]}</span>
                      )}
                      {s.status === "completed" && s.amountPaid < s.total && <PaymentStatus total={s.total} amountPaid={s.amountPaid} />}
                    </div>
                  </div>
                  {!(canCancel || canDelete) && <ChevronRight className="size-4 text-muted-foreground" />}
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
          <Pagination path="/ventes" params={params} page={page} total={summary.count} />
        </>
      )}
    </>
  );
}

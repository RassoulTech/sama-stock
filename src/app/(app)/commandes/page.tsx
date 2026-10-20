import { Bike, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentStatus, SaleStatus } from "@/components/sales/sale-status";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { param, pickParam, resolvePeriod, type PeriodPreset, type SearchParams } from "@/lib/filters";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { CHANNELS, ORDER_CHANNELS, type Channel } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listOrders, ORDER_FILTERS, orderCounts, type OrderFilter } from "@/server/queries/orders";

export const metadata: Metadata = { title: "Commandes" };

const PRESETS: PeriodPreset[] = ["tout", "today", "7j", "30j", "mois", "mois-dernier"];

export default async function CommandesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireContext("orders.manage");
  if (!ctx.business.moduleOrders) redirect("/tableau-de-bord");
  const params = await searchParams;
  const filter = pickParam(params, "filtre", Object.keys(ORDER_FILTERS) as OrderFilter[]) ?? "open";
  const period = resolvePeriod(params, { fallback: "tout", allowed: PRESETS });
  const channel = pickParam(params, "canal", ORDER_CHANNELS);
  const q = param(params, "q")?.slice(0, 60) ?? "";
  const search = { from: period.from, to: period.to, channel, q };

  const [orders, counts] = await Promise.all([listOrders(ctx, filter, search), orderCounts(ctx, search)]);

  const countFor = (f: OrderFilter) => {
    const statuses = ORDER_FILTERS[f].statuses;
    return statuses ? statuses.reduce((s, st) => s + (counts[st] ?? 0), 0) : Object.values(counts).reduce((a, b) => a + b, 0);
  };

  // Les onglets de statut gardent les autres filtres
  const statusHref = (key: OrderFilter) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "filtre") next.set(k, v);
    if (key !== "open") next.set("filtre", key);
    const qs = next.toString();
    return qs ? `/commandes?${qs}` : "/commandes";
  };

  return (
    <>
      <PageHeader
        title="Commandes"
        description="Commandes WhatsApp, Instagram, TikTok… suivies de la réception à la livraison."
        actions={
          !ctx.plan.readOnly && (
            <Button asChild>
              <Link href="/commandes/nouvelle">
                <Plus /> Nouvelle commande
              </Link>
            </Button>
          )
        }
      />

      <FilterBar
        search={{ value: q, placeholder: "N° de commande, client ou téléphone…" }}
        selects={[
          {
            name: "canal",
            allLabel: "Tous les canaux",
            value: channel,
            options: ORDER_CHANNELS.map((c) => ({ value: c, label: CHANNELS[c] })),
          },
        ]}
        period={{ value: period.key, presets: PRESETS, fallback: "tout", du: period.du, au: period.au, customLabel: period.label }}
        extraKeys={["filtre"]}
        className="mb-3"
      />

      <div className="scroll-row -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Statut">
        {(Object.entries(ORDER_FILTERS) as [OrderFilter, { label: string }][]).map(([key, f]) => (
          <Link
            key={key}
            href={statusHref(key)}
            role="tab"
            aria-selected={filter === key}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground",
              filter === key && "border-primary/30 bg-accent text-accent-foreground hover:text-accent-foreground",
            )}
          >
            {f.label}
            <span className={cn("num rounded-full bg-muted px-1.5 text-xs", filter === key && "bg-primary/10")}>{countFor(key)}</span>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Bike}
          title={filter === "open" && !q && !channel ? "Aucune commande en cours" : "Aucune commande ne correspond"}
          description="Enregistrez les commandes reçues sur WhatsApp ou Instagram : les produits sont réservés automatiquement."
          action={
            !ctx.plan.readOnly && (
              <Button asChild>
                <Link href="/commandes/nouvelle">
                  <Plus /> Nouvelle commande
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/commandes/${o.id}`}
                className="flex h-full items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:ring-primary/30"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.number}</span>
                    <SaleStatus kind="order" status={o.status} />
                    <StatusPill tone="gray">{CHANNELS[o.channel as Channel] ?? o.channel}</StatusPill>
                  </div>
                  <p className="truncate font-medium">{o.customerName ?? "Client inconnu"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(o.createdAt)} · {o.itemCount} article{o.itemCount > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="num font-semibold">{formatFCFA(o.total)}</span>
                  <PaymentStatus total={o.total} amountPaid={o.amountPaid} />
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

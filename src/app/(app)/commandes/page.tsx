import { Bike, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentStatus, SaleStatus } from "@/components/sales/sale-status";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { CHANNELS, type Channel } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listOrders, ORDER_FILTERS, orderCounts, type OrderFilter } from "@/server/queries/orders";

export const metadata: Metadata = { title: "Commandes" };

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext("orders.manage");
  if (!ctx.business.moduleOrders) redirect("/tableau-de-bord");
  const params = await searchParams;
  const filter = (typeof params.filtre === "string" && params.filtre in ORDER_FILTERS ? params.filtre : "open") as OrderFilter;
  const [orders, counts] = await Promise.all([listOrders(ctx, filter), orderCounts(ctx)]);

  const countFor = (f: OrderFilter) => {
    const statuses = ORDER_FILTERS[f].statuses;
    return statuses ? statuses.reduce((s, st) => s + (counts[st] ?? 0), 0) : Object.values(counts).reduce((a, b) => a + b, 0);
  };

  return (
    <>
      <PageHeader
        title="Commandes en ligne"
        description="WhatsApp, Instagram, TikTok… suivies de la réception à la livraison."
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
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {(Object.entries(ORDER_FILTERS) as [OrderFilter, { label: string }][]).map(([key, f]) => (
          <Link
            key={key}
            href={key === "open" ? "/commandes" : `/commandes?filtre=${key}`}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground",
              filter === key && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
            )}
          >
            {f.label}
            <span className={cn("num rounded-full bg-muted px-1.5 text-xs", filter === key && "bg-white/20")}>{countFor(key)}</span>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Bike}
          title={filter === "open" ? "Aucune commande en cours" : "Aucune commande ici"}
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
                className="flex h-full items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.07] transition-colors hover:ring-primary/30"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{o.number}</span>
                    <SaleStatus kind="order" status={o.status} />
                    <StatusPill tone="gray">{CHANNELS[o.channel as Channel] ?? o.channel}</StatusPill>
                  </div>
                  <p className="truncate font-medium">{o.customerName ?? "Client inconnu"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(o.createdAt)} · {o.itemCount} article{o.itemCount > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="num font-bold">{formatFCFA(o.total)}</span>
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

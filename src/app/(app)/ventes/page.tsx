import { ChevronRight, Plus, ReceiptText, ShoppingBag, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PaymentStatus, SaleStatus } from "@/components/sales/sale-status";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listSales, PERIODS, type Period } from "@/server/queries/sales";

export const metadata: Metadata = { title: "Ventes" };

export default async function VentesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext("sales.create");
  const params = await searchParams;
  const period = (typeof params.periode === "string" && params.periode in PERIODS ? params.periode : "today") as Period;
  const sales = await listSales(ctx, { period });
  const valid = sales.filter((s) => s.status === "completed");
  const revenue = valid.reduce((s, x) => s + x.total, 0);
  const cashed = valid.reduce((s, x) => s + x.amountPaid, 0);
  const own = !ctx.can("dashboard.full");

  return (
    <>
      <PageHeader
        title={own ? "Mes ventes" : "Ventes en boutique"}
        description={ctx.location.name}
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
      <div className="scroll-row -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {(Object.entries(PERIODS) as [Period, { label: string }][]).map(([key, p]) => (
          <Link
            key={key}
            href={`/ventes?periode=${key}`}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground",
              period === key && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Chiffre d'affaires" value={formatFCFA(revenue)} icon={Wallet} />
        <StatCard label="Ventes" value={valid.length} icon={ShoppingBag} tone="neutral" />
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
        <EmptyState icon={ReceiptText} title="Aucune vente sur cette période" description="Les ventes de la caisse apparaîtront ici." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.07]">
          {sales.map((s) => (
            <li key={s.id}>
              <Link href={`/ventes/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {s.number}
                    {s.status === "cancelled" && <SaleStatus kind="sale" status={s.status} />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(s.createdAt)} · {s.itemCount} article{s.itemCount > 1 ? "s" : ""}
                    {s.customerName && <> · {s.customerName}</>}
                    {!own && s.sellerName && <> · {s.sellerName}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("num font-bold", s.status === "cancelled" && "text-muted-foreground line-through")}>
                    {formatFCFA(s.total)}
                  </p>
                  <div className="flex items-center justify-end gap-1.5">
                    {s.paymentMethod && s.amountPaid > 0 && (
                      <span className="text-xs text-muted-foreground">{PAYMENT_METHODS[s.paymentMethod as PaymentMethod]}</span>
                    )}
                    {s.status === "completed" && s.amountPaid < s.total && <PaymentStatus total={s.total} amountPaid={s.amountPaid} />}
                  </div>
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

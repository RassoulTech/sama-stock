import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { movementTypeLabel, reasonLabel, SignedQty } from "@/components/stock/movement-label";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listMovements, MOVEMENT_GROUPS, type MovementGroup } from "@/server/queries/stock";

export const metadata: Metadata = { title: "Historique du stock" };

export default async function HistoriquePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext("products.view");
  const params = await searchParams;
  const group = (typeof params.type === "string" && params.type in MOVEMENT_GROUPS ? params.type : "all") as MovementGroup;
  const movements = await listMovements(ctx, { group });

  return (
    <>
      <PageHeader title="Historique du stock" description={`150 derniers mouvements · ${ctx.location.name}`} backHref="/stock" />
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {(Object.entries(MOVEMENT_GROUPS) as [MovementGroup, { label: string }][]).map(([key, g]) => (
          <Link
            key={key}
            href={key === "all" ? "/stock/historique" : `/stock/historique?type=${key}`}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground",
              group === key && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
            )}
          >
            {g.label}
          </Link>
        ))}
      </div>

      {movements.length === 0 ? (
        <EmptyState icon={History} title="Aucun mouvement" description="Les entrées, ventes et pertes apparaîtront ici." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.07]">
          {movements.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <Link href={`/produits/${m.productId}`} className="font-semibold hover:text-primary">
                  {m.productName}
                </Link>
                <p className="text-sm">
                  {movementTypeLabel(m.type)}
                  {reasonLabel(m.reason) && <span className="text-muted-foreground"> · {reasonLabel(m.reason)}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(m.createdAt)}
                  {m.userName && <> · {m.userName}</>}
                </p>
                {m.note && <p className="text-xs text-muted-foreground italic">{m.note}</p>}
              </div>
              <SignedQty quantity={m.quantity} unit={m.unit} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

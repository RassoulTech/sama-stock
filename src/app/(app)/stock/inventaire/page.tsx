import { ChevronRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { InventoryForm } from "@/components/stock/inventory-form";
import { param, type SearchParams } from "@/lib/filters";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { pageSlice, readPage } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listProducts } from "@/server/queries/products";
import { listInventories } from "@/server/queries/stock";

export const metadata: Metadata = { title: "Inventaire" };

export default async function InventairePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireContext("stock.adjust");
  const params = await searchParams;
  const history = param(params, "onglet") === "historique";
  const showCost = ctx.can("costs.view");
  if (!history && ctx.plan.readOnly) redirect("/stock/inventaire?onglet=historique");

  const page = readPage(params);
  const [products, past] = await Promise.all([history ? [] : listProducts(ctx), listInventories(ctx, pageSlice(page))]);

  return (
    <>
      <PageHeader title="Inventaire" description={`Compter le stock réel · ${ctx.location.name}`} backHref="/stock" />

      <div className="mb-5 flex gap-2" role="tablist" aria-label="Inventaire">
        {(
          [
            [false, "Nouveau comptage", "/stock/inventaire"],
            [true, `Inventaires passés (${past.total})`, "/stock/inventaire?onglet=historique"],
          ] as const
        ).map(([isHistory, label, href]) => (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={history === isHistory}
            className={cn(
              "inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm font-medium text-muted-foreground hover:text-foreground",
              history === isHistory && "border-primary/30 bg-accent text-accent-foreground hover:text-accent-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {!history ? (
        <InventoryForm
          showCost={showCost}
          locationName={ctx.location.name}
          firstTime={past.total === 0}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            physical: p.physical,
            // Prix d'achat envoyé seulement à qui peut le voir (valeur des écarts)
            costPrice: showCost ? (p.costPrice ?? 0) : 0,
            imageUrl: p.imageUrl,
            categoryName: p.categoryName,
          }))}
        />
      ) : past.rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun inventaire pour l'instant"
          description="Quand vous validez un comptage, il est gardé ici avec ses écarts et leur valeur."
        />
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {past.rows.map((inv) => (
              <li key={inv.id}>
                <Link href={`/stock/inventaire/${inv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Inventaire du {formatDateTime(inv.createdAt)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.counted} produit{inv.counted > 1 ? "s" : ""} compté{inv.counted > 1 ? "s" : ""}
                      {inv.userName && <> · par {inv.userName}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", inv.gaps > 0 ? "text-warning dark:text-saffron" : "text-success")}>
                      {inv.gaps === 0 ? "Aucun écart" : `${inv.gaps} écart${inv.gaps > 1 ? "s" : ""}`}
                    </p>
                    {showCost && inv.missingValue > 0 && <p className="num text-xs text-destructive">−{formatFCFA(inv.missingValue)}</p>}
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination path="/stock/inventaire" params={params} page={page} total={past.total} />
        </>
      )}
    </>
  );
}

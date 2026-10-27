import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { movementTypeLabel, reasonLabel, SignedQty } from "@/components/stock/movement-label";
import { param, pickParam, resolvePeriod, type PeriodPreset, type SearchParams } from "@/lib/filters";
import { formatDateTime } from "@/lib/format";
import { pageSlice, readPage } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listCategories } from "@/server/queries/products";
import { countMovements, listMovements, MOVEMENT_GROUPS, type MovementGroup } from "@/server/queries/stock";

export const metadata: Metadata = { title: "Historique du stock" };

const PRESETS: PeriodPreset[] = ["today", "7j", "30j", "mois", "mois-dernier", "90j", "tout"];

export default async function HistoriquePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireContext("products.view");
  const params = await searchParams;
  const group = pickParam(params, "type", Object.keys(MOVEMENT_GROUPS) as MovementGroup[]) ?? "all";
  const period = resolvePeriod(params, { fallback: "30j", allowed: PRESETS });
  const q = param(params, "q")?.slice(0, 60) ?? "";
  const categories = await listCategories(ctx.business.id);
  const categoryId = pickParam(params, "categorie", categories.map((c) => c.id));
  const filters = { group, from: period.from, to: period.to, q, categoryId };
  const page = readPage(params);
  const [movements, total] = await Promise.all([listMovements(ctx, filters, pageSlice(page)), countMovements(ctx, filters)]);

  const typeHref = (key: MovementGroup) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "type" && k !== "page") next.set(k, v);
    if (key !== "all") next.set("type", key);
    const qs = next.toString();
    return qs ? `/stock/historique?${qs}` : "/stock/historique";
  };

  return (
    <>
      <PageHeader title="Historique du stock" description={`Entrées, ventes, pertes et transferts · ${ctx.location.name}`} backHref="/stock" />

      <FilterBar
        search={{ value: q, placeholder: "Nom du produit…" }}
        selects={
          categories.length > 0
            ? [
                {
                  name: "categorie",
                  allLabel: "Toutes les catégories",
                  value: categoryId,
                  options: categories.map((c) => ({ value: c.id, label: c.name })),
                },
              ]
            : []
        }
        period={{ value: period.key, presets: PRESETS, fallback: "30j", du: period.du, au: period.au, customLabel: period.label }}
        resultLabel={`${total} mouvement${total > 1 ? "s" : ""}`}
        extraKeys={["type"]}
        className="mb-3"
      />

      <div className="scroll-row -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Type de mouvement">
        {(Object.entries(MOVEMENT_GROUPS) as [MovementGroup, { label: string }][]).map(([key, g]) => (
          <Link
            key={key}
            href={typeHref(key)}
            role="tab"
            aria-selected={group === key}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full border bg-card px-3 text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground",
              group === key && "border-primary/30 bg-accent text-accent-foreground hover:text-accent-foreground",
            )}
          >
            {g.label}
          </Link>
        ))}
      </div>

      {movements.length === 0 ? (
        <EmptyState icon={History} title="Aucun mouvement ne correspond" description="Changez la période ou les filtres." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
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
      <Pagination path="/stock/historique" params={params} page={page} total={total} />
    </>
  );
}

"use client";

import { ChevronRight, PackageSearch, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientPagination, usePaged } from "@/components/shared/client-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterChips } from "@/components/shared/filter-chips";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { StockBadge } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NO_CATEGORY } from "@/lib/filters";
import { formatFCFA, formatQty } from "@/lib/format";
import type { ProductRow } from "@/server/queries/products";
import { ProductThumb } from "./product-thumb";

type StateFilter = "all" | "low" | "out";
type Sort = "name" | "stock" | "price-asc" | "price-desc";


const SORTS: Record<Sort, string> = {
  name: "Trier : nom (A → Z)",
  stock: "Trier : stock le plus bas",
  "price-desc": "Trier : prix (plus cher)",
  "price-asc": "Trier : prix (moins cher)",
};

export function ProductList({
  products,
  categories,
  showCost,
  initialState = "all",
  initialCategory = "all",
  initialQuery = "",
}: {
  products: ProductRow[];
  categories: { id: string; name: string }[];
  showCost: boolean;
  initialState?: StateFilter;
  initialCategory?: string;
  /** Recherche venue de l'accueil (?q=…). */
  initialQuery?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [state, setState] = useState<StateFilter>(initialState);
  const [sort, setSort] = useState<Sort>("name");
  const hasUncategorized = products.some((p) => !p.categoryId);
  const active = q !== "" || category !== "all" || state !== "all" || sort !== "name";

  const counts = useMemo(
    () => ({
      all: products.length,
      low: products.filter((p) => p.status === "low").length,
      out: products.filter((p) => p.status === "out").length,
    }),
    [products],
  );

  const filtered = products
    .filter(
      (p) =>
        matchesSearch(q, p.name, p.reference, p.categoryName) &&
        (category === "all" || (category === NO_CATEGORY ? !p.categoryId : p.categoryId === category)) &&
        (state === "all" || p.status === state),
    )
    .sort((a, b) => {
      if (sort === "stock") return a.available - b.available || a.name.localeCompare(b.name, "fr");
      if (sort === "price-asc") return a.salePrice - b.salePrice;
      if (sort === "price-desc") return b.salePrice - a.salePrice;
      return a.name.localeCompare(b.name, "fr");
    });
  const { setTop, ...pager } = usePaged(filtered, `${q}|${category}|${state}|${sort}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder="Rechercher un produit…" className="flex-1" />
        {categories.length > 0 && (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Catégorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              {hasUncategorized && <SelectItem value={NO_CATEGORY}>Sans catégorie</SelectItem>}
            </SelectContent>
          </Select>
        )}
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-full sm:w-60" aria-label="Trier">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(SORTS) as [Sort, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterChips
          value={state}
          onChange={setState}
          options={[
            { value: "all", label: "Tous", count: counts.all },
            { value: "low", label: "Stock bas", count: counts.low },
            { value: "out", label: "Rupture", count: counts.out },
          ]}
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {filtered.length} produit{filtered.length > 1 ? "s" : ""}
          </span>
          {active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setCategory("all");
                setState("all");
                setSort("name");
              }}
            >
              <RotateCcw /> Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Aucun produit trouvé"
          description="Essayez un autre mot ou retirez les filtres."
        />
      ) : (
        <>
          <div ref={setTop} className="scroll-mt-20" />
          {/* Mobile : cartes */}
          <ul className="space-y-2 md:hidden">
            {pager.items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/produits/${p.id}`}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 border active:bg-muted"
                >
                  <ProductThumb name={p.name} imageUrl={p.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="num text-sm text-muted-foreground">
                      {formatFCFA(p.salePrice)} · {formatQty(p.available, p.unit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StockBadge status={p.status} />
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Ordinateur : tableau */}
          <div className="hidden overflow-hidden rounded-xl bg-card border md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Prix de vente</TableHead>
                  {showCost && <TableHead className="text-right">Prix d&apos;achat</TableHead>}
                  {showCost && <TableHead className="text-right">Marge</TableHead>}
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="pr-5">État</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pager.items.map((p) => {
                  const margin = p.costPrice !== null ? p.salePrice - p.costPrice : null;
                  return (
                    <TableRow key={p.id} className="group relative">
                      <TableCell className="pl-5">
                        <Link href={`/produits/${p.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                          <ProductThumb name={p.name} imageUrl={p.imageUrl} className="size-10" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold group-hover:text-primary">{p.name}</span>
                            {p.reference && <span className="text-xs text-muted-foreground">{p.reference}</span>}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.categoryName ?? "—"}</TableCell>
                      <TableCell className="num text-right font-medium">{formatFCFA(p.salePrice)}</TableCell>
                      {showCost && (
                        <TableCell className="num text-right text-muted-foreground">
                          {formatFCFA(p.costPrice ?? 0)}
                        </TableCell>
                      )}
                      {showCost && (
                        <TableCell
                          className={`num text-right font-medium ${margin !== null && margin < 0 ? "text-destructive" : "text-success"}`}
                        >
                          {margin !== null ? formatFCFA(margin) : "—"}
                        </TableCell>
                      )}
                      <TableCell className="num text-right">
                        {formatQty(p.available, p.unit)}
                        {p.reserved > 0 && (
                          <span className="block text-xs text-muted-foreground">{formatQty(p.reserved)} réservé(s)</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-5">
                        <StockBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ClientPagination pager={pager} />
        </>
      )}
    </div>
  );
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SearchParams } from "@/lib/filters";
import { PAGE_SIZE, pageCount, pageHref, pageItems, rangeLabel } from "@/lib/pagination";
import { cn } from "@/lib/utils";

const ITEM = "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium transition-colors";

/**
 * Pages d'une liste : « Précédent · 1 … 5 6 7 … 12 · Suivant » (« 3 / 12 » sur téléphone).
 * Avec `href`, ce sont des liens (listes lues sur le serveur) ; avec `onSelect`, des boutons (listes filtrées dans la page).
 */
export function PaginationNav({
  page,
  total,
  pageSize = PAGE_SIZE,
  href,
  onSelect,
  className,
}: {
  page: number;
  total: number;
  pageSize?: number;
  href?: (page: number) => string;
  onSelect?: (page: number) => void;
  className?: string;
}) {
  const count = pageCount(total, pageSize);
  if (count <= 1 && page <= 1) return null;
  const current = Math.min(page, count);

  return (
    <nav aria-label="Pages" className={cn("mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between print:hidden", className)}>
      <p className="num text-xs text-muted-foreground">{rangeLabel(current, total, pageSize)}</p>
      <div className="flex items-center gap-1">
        {current > 1 ? (
          <PageItem to={current - 1} href={href} onSelect={onSelect} className="border bg-card hover:bg-muted" rel="prev">
            <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Précédent</span>
            <span className="sr-only sm:hidden">Page précédente</span>
          </PageItem>
        ) : (
          <span className={cn(ITEM, "border bg-card opacity-40")} aria-hidden>
            <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Précédent</span>
          </span>
        )}
        {/* Sur téléphone : « 3 / 12 » à la place des numéros */}
        <span className="num px-3 text-sm font-medium sm:hidden">
          {current} / {count}
        </span>
        {pageItems(current, count).map((item, i) =>
          item === "…" ? (
            <span key={`gap-${i}`} className="hidden px-1 text-sm text-muted-foreground sm:inline" aria-hidden>
              …
            </span>
          ) : item === current ? (
            <span key={item} aria-current="page" className={cn(ITEM, "num hidden bg-primary text-primary-foreground sm:inline-flex")}>
              {item}
            </span>
          ) : (
            <PageItem key={item} to={item} href={href} onSelect={onSelect} className="num hidden hover:bg-muted sm:inline-flex" aria-label={`Page ${item}`}>
              {item}
            </PageItem>
          ),
        )}
        {current < count ? (
          <PageItem to={current + 1} href={href} onSelect={onSelect} className="border bg-card hover:bg-muted" rel="next">
            <span className="hidden sm:inline">Suivant</span>
            <span className="sr-only sm:hidden">Page suivante</span> <ChevronRight className="size-4" />
          </PageItem>
        ) : (
          <span className={cn(ITEM, "border bg-card opacity-40")} aria-hidden>
            <span className="hidden sm:inline">Suivant</span> <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}

function PageItem({
  to,
  href,
  onSelect,
  className,
  children,
  ...rest
}: {
  to: number;
  href?: (page: number) => string;
  onSelect?: (page: number) => void;
  className?: string;
  children: React.ReactNode;
  rel?: string;
} & React.AriaAttributes) {
  if (href) {
    return (
      <Link href={href(to)} className={cn(ITEM, className)} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onSelect?.(to)} className={cn(ITEM, "cursor-pointer", className)} {...rest}>
      {children}
    </button>
  );
}

/** Pagination d'une liste lue sur le serveur : liens ?page=…, en gardant les filtres de l'adresse. */
export function Pagination({
  path,
  params,
  page,
  total,
  pageSize = PAGE_SIZE,
  className,
}: {
  path: string;
  params: SearchParams;
  page: number;
  total: number;
  pageSize?: number;
  className?: string;
}) {
  return <PaginationNav page={page} total={total} pageSize={pageSize} href={(n) => pageHref(path, params, n)} className={className} />;
}

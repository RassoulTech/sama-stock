import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SearchParams } from "@/lib/filters";
import { PAGE_SIZE, pageCount, pageHref, pageItems, rangeLabel } from "@/lib/pagination";
import { cn } from "@/lib/utils";

// Téléphone d'abord : boutons de 44 px, plus serrés sur ordinateur
const ITEM =
  "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl px-3 text-sm font-medium transition-colors sm:h-10 sm:min-w-10 sm:rounded-lg";

/**
 * Pages d'une liste : « Précédent · 1 … 5 6 7 … 12 · Suivant » (« 3 / 12 » sur téléphone).
 * Toujours affichée dès qu'il y a une ligne (boutons grisés s'il n'y a qu'une page), cachée pour une liste vide.
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
  if (total === 0) return null;
  const current = Math.min(page, count);

  return (
    <nav
      aria-label="Pages"
      className={cn("mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden", className)}
    >
      <p className="num order-last text-center text-xs text-muted-foreground sm:order-none sm:text-left">
        {rangeLabel(current, total, pageSize)}
      </p>
      {/* Téléphone : « ‹ Précédent · 3 / 12 · Suivant › » sur toute la largeur ; ordinateur : les numéros */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:gap-1">
        {current > 1 ? (
          <PageItem to={current - 1} href={href} onSelect={onSelect} className="border bg-card shadow-[0_1px_2px_rgb(11_19_16/0.05)] hover:bg-muted" rel="prev">
            <ChevronLeft className="size-4" /> Précédent
          </PageItem>
        ) : (
          <span className={cn(ITEM, "border bg-card opacity-40")} aria-hidden>
            <ChevronLeft className="size-4" /> Précédent
          </span>
        )}
        <span className="num min-w-16 text-center text-sm font-semibold sm:hidden">
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
          <PageItem to={current + 1} href={href} onSelect={onSelect} className="border bg-card shadow-[0_1px_2px_rgb(11_19_16/0.05)] hover:bg-muted" rel="next">
            Suivant <ChevronRight className="size-4" />
          </PageItem>
        ) : (
          <span className={cn(ITEM, "border bg-card opacity-40")} aria-hidden>
            Suivant <ChevronRight className="size-4" />
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

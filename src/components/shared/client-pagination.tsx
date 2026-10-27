"use client";

import { useState } from "react";
import { PAGE_SIZE, pageCount } from "@/lib/pagination";
import { PaginationNav } from "./pagination";

/**
 * Découpe en pages une liste déjà filtrée dans la page (produits, clients…).
 * `resetKey` résume les filtres : quand il change, on revient à la page 1.
 */
export function usePaged<T>(items: T[], resetKey: string, pageSize = PAGE_SIZE) {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  // Élément au-dessus de la liste, gardé par une ref « fonction » (div, ul…)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const page = Math.min(state.key === resetKey ? state.page : 1, pageCount(items.length, pageSize));
  return {
    page,
    total: items.length,
    pageSize,
    items: items.slice((page - 1) * pageSize, page * pageSize),
    /** À poser juste au-dessus de la liste : on y remonte en changeant de page. */
    setTop: setAnchor,
    go(next: number) {
      setState({ key: resetKey, page: next });
      anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  };
}

/** `pager` = le résultat de usePaged sans `setTop` (posé à part sur l'élément du haut de la liste). */
export function ClientPagination({ pager }: { pager: Omit<ReturnType<typeof usePaged<unknown>>, "setTop"> }) {
  return <PaginationNav page={pager.page} total={pager.total} pageSize={pager.pageSize} onSelect={pager.go} />;
}

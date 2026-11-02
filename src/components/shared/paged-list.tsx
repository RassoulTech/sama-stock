"use client";

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { PAGE_SIZE } from "@/lib/pagination";
import { ClientPagination, usePaged } from "./client-pagination";

/**
 * Liste découpée en pages dans le navigateur, pour une liste préparée sur le serveur (les <li> sont passés tels quels).
 * Les lignes des autres pages restent dans la page, cachées à l'écran : l'impression garde la liste entière.
 */
export function PagedList({ children, className, pageSize = PAGE_SIZE }: { children: ReactNode; className?: string; pageSize?: number }) {
  const items = Children.toArray(children);
  const { setTop, ...pager } = usePaged(items, String(items.length), pageSize);
  const from = (pager.page - 1) * pageSize;
  return (
    <>
      <div ref={setTop} className="scroll-mt-20" />
      <ul className={className}>
        {items.map((item, i) =>
          (i >= from && i < from + pageSize) || !isValidElement(item)
            ? item
            : cloneElement(item as ReactElement<Record<string, unknown>>, { "data-hors-page": "" }),
        )}
      </ul>
      <ClientPagination pager={pager} />
    </>
  );
}

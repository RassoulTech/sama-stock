import { param, type SearchParams } from "./filters";

/** Nombre de lignes par page dans les listes (ventes, commandes, clients, admin…). */
export const PAGE_SIZE = 30;

/** Numéro de page demandé dans l'adresse (?page=3), 1 par défaut. */
export function readPage(params: SearchParams): number {
  const n = Number(param(params, "page"));
  return Number.isInteger(n) && n > 1 ? Math.min(n, 100_000) : 1;
}

export function pageSlice(page: number, size = PAGE_SIZE): { limit: number; offset: number } {
  return { limit: size, offset: (page - 1) * size };
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/**
 * Numéros affichés : la première, la dernière et les voisines de la page en cours, avec « … » entre les trous.
 * Ex. page 6 sur 12 → 1 … 5 6 7 … 12.
 */
export function pageItems(page: number, count: number): (number | "…")[] {
  const keep = new Set([1, count, page - 1, page, page + 1].filter((n) => n >= 1 && n <= count));
  const sorted = [...keep].sort((a, b) => a - b);
  const items: (number | "…")[] = [];
  for (const n of sorted) {
    const prev = items.at(-1);
    if (typeof prev === "number" && n - prev === 2) items.push(prev + 1);
    else if (typeof prev === "number" && n - prev > 2) items.push("…");
    items.push(n);
  }
  return items;
}

/** Adresse de la page n, en gardant les filtres en cours. */
export function pageHref(path: string, params: SearchParams, page: number): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) next.append(k, one);
  }
  if (page > 1) next.set("page", String(page));
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Texte « 31 à 60 sur 245 ». */
export function rangeLabel(page: number, total: number, size = PAGE_SIZE): string {
  if (total === 0) return "0 résultat";
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return `${from} à ${to} sur ${new Intl.NumberFormat("fr-FR").format(total)}`;
}

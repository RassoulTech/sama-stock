/**
 * Adresse personnelle d'une boutique sous licence : …/b/quincaillerie-ndiaye
 * (plus tard quincaillerie-ndiaye.samastock.sn). Lettres minuscules, chiffres et tirets.
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** Mots réservés : pages du site et futurs sous-domaines techniques. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "aide",
  "api",
  "app",
  "assets",
  "blog",
  "connexion",
  "demo",
  "hors-ligne",
  "inscription",
  "mail",
  "sama-stock",
  "samastock",
  "static",
  "support",
  "www",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** « Quincaillerie Ndiaye & Fils » → « quincaillerie-ndiaye-et-fils ». */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return base.length >= SLUG_MIN ? base : `boutique-${base || "sama"}`.replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Première adresse libre : nom, nom-2, nom-3… (et jamais un mot réservé). */
export function pickSlug(base: string, taken: Set<string>): string {
  const root = RESERVED_SLUGS.has(base) ? `${base}-boutique` : base;
  let candidate = root;
  for (let i = 2; taken.has(candidate); i++) {
    const suffix = `-${i}`;
    candidate = `${root.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
  }
  return candidate;
}

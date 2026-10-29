import { isValidSlug } from "./domain/slug";

/** Nom de domaine de Sama Stock ; chaque boutique sous licence a son adresse : nom.sama-stock.com */
export const MAIN_DOMAIN = "sama-stock.com";

/**
 * Ancienne adresse du site, toujours valable : les boutiques installées avant le nom de domaine
 * (application sur le téléphone, appareils des employés, ventes hors ligne) continuent de l'utiliser.
 */
export const LEGACY_HOST = "sama-stock-one.vercel.app";

/** Origines acceptées pour se connecter (en plus de l'adresse principale). */
export const TRUSTED_ORIGINS = [`https://${MAIN_DOMAIN}`, `https://*.${MAIN_DOMAIN}`, `https://${LEGACY_HOST}`];

/** « senegal-sanitary.sama-stock.com » → « senegal-sanitary » ; null pour le site principal, www ou une autre adresse. */
export function shopSlugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.toLowerCase().split(":")[0]!;
  const suffix = `.${MAIN_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return null;
  const sub = hostname.slice(0, -suffix.length);
  return !sub.includes(".") && isValidSlug(sub) ? sub : null;
}

/** Adresse de l'application d'une boutique à donner au client : son sous-domaine en ligne, …/b/nom en local. */
export function shopAppUrl(origin: string, slug: string): string {
  const host = new URL(origin).hostname;
  const online = host === MAIN_DOMAIN || host.endsWith(`.${MAIN_DOMAIN}`) || host === LEGACY_HOST;
  return online ? `https://${slug}.${MAIN_DOMAIN}` : `${origin}/b/${slug}`;
}

/** Ancienne adresse d'une boutique (toujours valable). */
export function legacyShopUrl(slug: string): string {
  return `https://${LEGACY_HOST}/b/${slug}`;
}

/** Pages publiques (vitrine) : sur l'ancienne adresse, elles renvoient vers sama-stock.com pour Google. */
export const PUBLIC_PAGES = ["/", "/inscription", "/demo", "/mentions-legales", "/confidentialite", "/conditions"];

/**
 * Ancienne adresse : renvoi des pages de la vitrine vers sama-stock.com (une seule adresse dans Google).
 * Jamais pour quelqu'un de connecté ni pour un appareil de boutique : leur application reste sur l'ancienne adresse.
 */
export function legacyRedirect(host: string | null | undefined, pathname: string, opts: { hasSession: boolean; hasShop: boolean }): string | null {
  if (!host || host.toLowerCase().split(":")[0] !== LEGACY_HOST) return null;
  if (opts.hasSession || opts.hasShop || !PUBLIC_PAGES.includes(pathname)) return null;
  return `https://${MAIN_DOMAIN}${pathname === "/" ? "" : pathname}`;
}

/** Ce que les moteurs de recherche peuvent explorer selon l'adresse : tout (site principal), la vitrine (ancienne adresse), rien (boutiques, essais Vercel). */
export function crawlScope(host: string | null | undefined): "site" | "legacy" | "none" {
  const hostname = (host ?? "").toLowerCase().split(":")[0];
  if (hostname === MAIN_DOMAIN || hostname === "localhost") return "site";
  if (hostname === LEGACY_HOST) return "legacy";
  return "none";
}

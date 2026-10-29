import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { crawlScope, PUBLIC_PAGES } from "@/lib/domains";
import { NOT_INDEXED_PREFIXES, PROTECTED_PREFIXES } from "@/lib/routes";
import { SITE_URL } from "@/lib/seo";

/**
 * Selon l'adresse : sama-stock.com s'explore entièrement (sauf l'espace privé) ; l'ancienne adresse seulement sa
 * vitrine (qui renvoie vers sama-stock.com) ; les adresses des boutiques et les essais Vercel pas du tout.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const scope = crawlScope((await headers()).get("host"));
  if (scope === "none") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      // « /$ » = la page d'accueil seule (« / » autoriserait tout le site)
      allow: scope === "site" ? "/" : PUBLIC_PAGES.map((p) => (p === "/" ? "/$" : p)),
      disallow: scope === "site" ? [...PROTECTED_PREFIXES, ...NOT_INDEXED_PREFIXES] : "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

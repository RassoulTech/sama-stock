import type { Metadata } from "next";

/** Adresse publique du site : liens canoniques, sitemap et aperçus de partage. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://sama-stock-one.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "Sama Stock";

/** Métadonnées d'une page publique : titre, description, URL canonique et aperçu de partage cohérents. */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  // Une page qui définit son openGraph ne reçoit plus l'image du parent : on la redonne explicitement
  const images = [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE_NAME} — gestion de stock au Sénégal` }];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "fr_SN", url: path, title: fullTitle, description, images },
    twitter: { card: "summary_large_image", title: fullTitle, description, images },
  };
}

/** Pages privées ou utilitaires : jamais dans les résultats de recherche. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };

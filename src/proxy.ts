import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { isValidSlug } from "@/lib/domain/slug";
import { legacyRedirect, shopSlugFromHost } from "@/lib/domains";
import { isProtectedPath } from "@/lib/routes";
import { DEVICE_COOKIE_NAME, OTHER_ACCOUNT_PARAM, SHOP_COOKIE } from "@/lib/shop-app";

// Vérification « optimiste » : seule la présence du cookie est testée ici, et seulement sur les espaces privés.
// La vraie vérification (session valide, droits) se fait côté serveur dans chaque page et action.
// Les autres adresses passent : une page inexistante répond donc par une vraie erreur 404.
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  // Adresse d'une boutique (nom.sama-stock.com) : l'accueil est sa page de connexion, puis l'application
  const hostShop = shopSlugFromHost(request.headers.get("host"));
  if (hostShop) {
    if (pathname === "/") {
      if (hasSession) return NextResponse.redirect(new URL(`/b/${hostShop}/entrer`, request.url));
      return NextResponse.rewrite(new URL(`/b/${hostShop}${search}`, request.url));
    }
    if ((isProtectedPath(pathname) && !hasSession) || (pathname === "/connexion" && !searchParams.has(OTHER_ACCOUNT_PARAM))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }
  const shop = request.cookies.get(SHOP_COOKIE)?.value;
  const shopPage = shop && isValidSlug(shop) ? `/b/${shop}` : null;

  // Ancienne adresse : sa vitrine renvoie vers sama-stock.com (une seule adresse dans Google) ;
  // les personnes connectées et les appareils des boutiques déjà installées n'en sont jamais détournés
  const moved = legacyRedirect(request.headers.get("host"), pathname, { hasSession, hasShop: Boolean(shopPage) });
  if (moved) return NextResponse.redirect(`${moved}${search}`, 308);

  if (isProtectedPath(pathname) && !hasSession) {
    // Appareil d'une boutique : on revient sur sa page de connexion (son logo, ses employés, le code PIN)
    if (shopPage) return NextResponse.redirect(new URL(shopPage, request.url));
    const url = new URL("/connexion", request.url);
    url.searchParams.set("redirect", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname === "/connexion" && shopPage) {
    // « Autre compte » : on oublie la boutique de cet appareil (sur un vrai clic, jamais sur un préchargement)
    if (searchParams.has(OTHER_ACCOUNT_PARAM)) {
      if (isPrefetch(request)) return NextResponse.next();
      const res = NextResponse.next();
      res.cookies.delete(SHOP_COOKIE);
      return res;
    }
    return NextResponse.redirect(new URL(shopPage, request.url));
  }

  // Appareil activé pour la boutique : l'adresse du site ouvre l'application de la boutique
  if (pathname === "/" && shopPage && request.cookies.has(DEVICE_COOKIE_NAME)) {
    return NextResponse.redirect(new URL(hasSession ? "/tableau-de-bord" : shopPage, request.url));
  }
  return NextResponse.next();
}

/** Requête de préchargement d'un lien (le navigateur anticipe un clic qui n'a pas eu lieu). */
function isPrefetch(request: NextRequest): boolean {
  const h = request.headers;
  return h.has("next-router-prefetch") || h.get("sec-purpose")?.includes("prefetch") === true || h.get("purpose") === "prefetch";
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt|xml|mp4|webm|mp3|woff2)$).*)",
  ],
};

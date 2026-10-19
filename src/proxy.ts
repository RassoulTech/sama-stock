import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath } from "@/lib/routes";

// Vérification « optimiste » : seule la présence du cookie est testée ici, et seulement sur les espaces privés.
// La vraie vérification (session valide, droits) se fait côté serveur dans chaque page et action.
// Les autres adresses passent : une page inexistante répond donc par une vraie erreur 404.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtectedPath(pathname) && !getSessionCookie(request)) {
    const url = new URL("/connexion", request.url);
    url.searchParams.set("redirect", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt|xml|mp4|webm|mp3|woff2)$).*)",
  ],
};

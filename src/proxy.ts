import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/", "/connexion", "/inscription", "/demo"]);

// Vérification « optimiste » : seule la présence du cookie est testée ici.
// La vraie vérification (session valide, droits) se fait côté serveur dans chaque page et action.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname) || pathname.startsWith("/invitation/");

  if (!isPublic && !getSessionCookie(request)) {
    const url = new URL("/connexion", request.url);
    url.searchParams.set("redirect", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt)$).*)",
  ],
};

import type { MetadataRoute } from "next";
import { shopColors, shortAppName } from "@/lib/domain/shop-brand";
import { shopBySlug, shopIcon } from "@/server/queries/shop-login";

/** Fiche d'installation de l'application d'une boutique : son nom et son icône sur l'écran d'accueil. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) return new Response("Boutique introuvable", { status: 404 });

  const base = `/b/${shop.slug}`;
  const manifest: MetadataRoute.Manifest = {
    id: base,
    name: shop.name,
    short_name: shortAppName(shop.name),
    description: `Application de gestion de ${shop.name}.`,
    lang: "fr",
    start_url: base,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: shopColors(shop.brandColor).sidebar,
    theme_color: shopColors(shop.brandColor).sidebar,
    icons: [
      { src: shopIcon(shop, 192), sizes: "192x192", type: "image/png" },
      { src: shopIcon(shop, 512), sizes: "512x512", type: "image/png" },
      { src: shopIcon(shop, 512, true), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

import type { MetadataRoute } from "next";

/**
 * Manifeste de l'application Sama Stock. Servi par une route (et non par le fichier manifest.ts) pour que la page
 * de connexion de chaque boutique puisse déclarer le sien : son nom et son logo sur l'écran d'accueil.
 */
const manifest: MetadataRoute.Manifest = {
  id: "/",
  name: "Sama Stock",
  short_name: "Sama Stock",
  description: "Stock, ventes, commandes WhatsApp et crédits clients pour les commerçants du Sénégal.",
  lang: "fr",
  start_url: "/tableau-de-bord",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#f7f8f5",
  theme_color: "#0b6e4f",
  categories: ["business", "finance", "productivity"],
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "Vendre", url: "/vendre", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    { name: "Nouvelle commande", url: "/commandes/nouvelle", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
  ],
};

export function GET() {
  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
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
}

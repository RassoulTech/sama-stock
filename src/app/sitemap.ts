import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Date de la dernière mise à jour du contenu public (à avancer quand ces pages changent)
const UPDATED = new Date("2026-10-20");

/** Uniquement les pages publiques réellement destinées aux moteurs de recherche. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/inscription", priority: 0.8, changeFrequency: "monthly" },
    { path: "/demo", priority: 0.8, changeFrequency: "monthly" },
    { path: "/connexion", priority: 0.5, changeFrequency: "yearly" },
    { path: "/mentions-legales", priority: 0.3, changeFrequency: "yearly" },
    { path: "/confidentialite", priority: 0.3, changeFrequency: "yearly" },
    { path: "/conditions", priority: 0.3, changeFrequency: "yearly" },
  ];
  return pages.map((p) => ({
    url: `${SITE_URL}${p.path === "/" ? "" : p.path}`,
    lastModified: UPDATED,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}

import type { MetadataRoute } from "next";
import { NOT_INDEXED_PREFIXES, PROTECTED_PREFIXES } from "@/lib/routes";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PROTECTED_PREFIXES, ...NOT_INDEXED_PREFIXES],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

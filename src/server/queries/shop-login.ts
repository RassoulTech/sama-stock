import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { isValidSlug } from "@/lib/domain/slug";

/** Boutique sous licence à partir de l'adresse de sa page de connexion (…/b/son-nom). */
export const shopBySlug = cache(async (slug: string) => {
  if (!isValidSlug(slug)) return null;
  const [shop] = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      city: businesses.city,
      logo: businesses.logo,
      brandColor: businesses.brandColor,
      slug: businesses.slug,
    })
    .from(businesses)
    .where(and(eq(businesses.slug, slug), isNotNull(businesses.licensePack)));
  return shop ?? null;
});

export type Shop = NonNullable<Awaited<ReturnType<typeof shopBySlug>>>;

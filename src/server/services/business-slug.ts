import "server-only";
import { eq, like } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { businesses } from "@/db/schema";
import { pickSlug, slugify } from "@/lib/domain/slug";

/** Adresse de la page de connexion d'une boutique : créée à partir de son nom si elle n'existe pas encore. */
export async function ensureBusinessSlug(exec: DbOrTx, businessId: string): Promise<string | null> {
  const [b] = await exec.select({ slug: businesses.slug, name: businesses.name }).from(businesses).where(eq(businesses.id, businessId));
  if (!b) return null;
  if (b.slug) return b.slug;
  const base = slugify(b.name);
  const taken = await exec.select({ slug: businesses.slug }).from(businesses).where(like(businesses.slug, `${base}%`));
  const slug = pickSlug(base, new Set(taken.map((t) => t.slug).filter((s): s is string => Boolean(s))));
  await exec.update(businesses).set({ slug }).where(eq(businesses.id, businessId));
  return slug;
}

import "server-only";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { businesses, members, user } from "@/db/schema";
import { isRole, ROLE_LABELS } from "@/lib/domain/permissions";
import { isValidSlug } from "@/lib/domain/slug";

/**
 * Boutique à partir de l'adresse de sa page de connexion (…/b/son-nom). Les licences ont leur adresse dès la vente,
 * les autres dès l'activation d'un appareil pour les employés. Couleurs et nom personnalisés : licences seulement.
 */
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
      licensePack: businesses.licensePack,
    })
    .from(businesses)
    .where(eq(businesses.slug, slug));
  if (!shop) return null;
  const licensed = shop.licensePack !== null;
  return { ...shop, licensed, brandColor: licensed ? shop.brandColor : null };
});

export type Shop = NonNullable<Awaited<ReturnType<typeof shopBySlug>>>;

/** Membres qui peuvent ouvrir leur session avec un code PIN (affichés seulement sur un appareil activé). */
export async function staffWithPin(businessId: string) {
  const rows = await db
    .select({ id: members.id, name: user.name, role: members.role })
    .from(members)
    .innerJoin(user, eq(user.id, members.userId))
    .where(and(eq(members.businessId, businessId), isNotNull(members.pinHash)))
    .orderBy(asc(user.name));
  return rows.map((r) => ({ id: r.id, name: r.name, roleLabel: isRole(r.role) ? ROLE_LABELS[r.role] : r.role }));
}

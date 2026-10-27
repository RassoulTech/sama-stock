import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { getContext } from "./context";
import { shopBySlug } from "./queries/shop-login";
import { ensureBusinessSlug } from "./services/business-slug";

/**
 * Application de la boutique en cours (nom, logo, couleur, adresse /b/…) : c'est elle qu'on installe depuis
 * l'espace connecté. La démo garde l'application Sama Stock.
 */
export const currentShopApp = cache(async () => {
  const ctx = await getContext();
  if (!ctx?.business || ctx.business.isDemo) return null;
  // Adresse créée une seule fois, au premier passage (les anciennes boutiques n'en avaient pas)
  const slug = ctx.business.slug ?? (await ensureBusinessSlug(db, ctx.business.id));
  return slug ? shopBySlug(slug) : null;
});

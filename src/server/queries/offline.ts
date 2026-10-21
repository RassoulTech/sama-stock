import "server-only";
import type { OfflineSnapshot } from "@/lib/offline/types";
import type { BusinessContext } from "../context";
import { customerOptions } from "./customers";
import { listCategories, listProducts } from "./products";

/** Copie de la caisse gardée par le téléphone : jamais de prix d'achat ni de bénéfice. */
export async function offlineSnapshot(ctx: BusinessContext): Promise<OfflineSnapshot> {
  const [products, categories, customers] = await Promise.all([
    listProducts(ctx),
    listCategories(ctx.business.id),
    customerOptions(ctx.business.id),
  ]);
  const b = ctx.business;
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    user: { id: ctx.user.id, name: ctx.user.name },
    business: {
      id: b.id,
      name: b.name,
      logo: b.logo,
      address: b.address,
      city: b.city,
      phone: b.phone,
      brandColor: b.brandColor,
      licensed: Boolean(ctx.plan.license),
    },
    location: { id: ctx.location.id, name: ctx.location.name },
    can: { sell: ctx.can("sales.create"), viewStock: ctx.can("products.view") },
    plan: {
      readOnly: ctx.plan.readOnly,
      // Licence : la date de fin est celle de la maintenance, qui ne bloque jamais la caisse
      sellUntil: ctx.plan.license ? null : (ctx.plan.endsAt?.toISOString() ?? null),
      label: ctx.plan.label,
    },
    modulePos: b.modulePos,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      salePrice: p.salePrice,
      available: p.available,
      alertThreshold: p.alertThreshold,
      categoryId: p.categoryId,
    })),
    categories: categories.filter((c) => products.some((p) => p.categoryId === c.id)),
    customers,
  };
}

import { Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PosScreen } from "@/components/pos/pos-screen";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { requireContext } from "@/server/context";
import { customerOptions } from "@/server/queries/customers";
import { listCategories, listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Vendre" };

export default async function VendrePage() {
  const ctx = await requireContext("sales.create");
  if (!ctx.business.modulePos) redirect("/tableau-de-bord");
  if (ctx.plan.readOnly) redirect("/ventes");

  const [products, categories, customers] = await Promise.all([
    listProducts(ctx),
    listCategories(ctx.business.id),
    customerOptions(ctx.business.id),
  ]);

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Aucun produit à vendre"
        description="Ajoutez d'abord vos produits avec leur prix et leur stock."
        action={
          ctx.can("products.manage") && (
            <Button asChild>
              <Link href="/produits/nouveau">
                <Plus /> Ajouter un produit
              </Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <PosScreen
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        salePrice: p.salePrice,
        available: p.available,
        imageUrl: p.imageUrl,
        categoryId: p.categoryId,
      }))}
      categories={categories.filter((c) => products.some((p) => p.categoryId === c.id))}
      customers={customers}
    />
  );
}

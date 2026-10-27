import { FileSpreadsheet, Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductList } from "@/components/products/product-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PlanUsage } from "@/components/shared/plan-usage";
import { Button } from "@/components/ui/button";
import { NO_CATEGORY, param, pickParam } from "@/lib/filters";
import { requireContext } from "@/server/context";
import { listCategories, listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Produits" };

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext("products.view");
  const params = await searchParams;
  const [products, categories] = await Promise.all([listProducts(ctx), listCategories(ctx.business.id)]);
  const canManage = ctx.can("products.manage") && !ctx.plan.readOnly;
  // L'import Excel n'existe pas dans l'essai gratuit (toutes les licences l'ont)
  const canImport = canManage && ctx.plan.limits.excel;
  const initialState = params.etat === "bas" ? "low" : params.etat === "rupture" ? "out" : "all";
  const initialCategory = pickParam(params, "categorie", [...categories.map((c) => c.id), NO_CATEGORY]) ?? "all";

  return (
    <>
      <PageHeader
        title="Produits"
        description={`${products.length} produit${products.length > 1 ? "s" : ""} · stock de ${ctx.location.name}`}
        actions={
          canManage && (
            <>
              {canImport && (
                <Button asChild variant="outline">
                  <Link href="/produits/importer">
                    <FileSpreadsheet /> Importer (Excel)
                  </Link>
                </Button>
              )}
              <Button asChild>
                <Link href="/produits/nouveau">
                  <Plus /> Nouveau produit
                </Link>
              </Button>
            </>
          )
        }
      />
      {ctx.can("products.manage") && (
        <PlanUsage
          label="produits utilisés"
          used={products.length}
          limit={ctx.plan.limits.maxProducts}
          showUpgrade={ctx.can("billing.manage")}
        />
      )}
      <div className="mt-5">
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Ajoutez votre premier produit"
            description={
              canImport
                ? "Nom, prix, quantité en stock : c'est tout ce qu'il faut pour commencer. Vous avez déjà une liste dans Excel ? Importez-la d'un coup."
                : "Nom, prix, quantité en stock : c'est tout ce qu'il faut pour commencer."
            }
            action={
              canManage && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link href="/produits/nouveau">
                      <Plus /> Nouveau produit
                    </Link>
                  </Button>
                  {canImport && (
                    <Button asChild variant="outline">
                      <Link href="/produits/importer">
                        <FileSpreadsheet /> Importer (Excel)
                      </Link>
                    </Button>
                  )}
                </div>
              )
            }
          />
        ) : (
          <ProductList
            products={products}
            categories={categories}
            showCost={ctx.can("costs.view")}
            initialState={initialState}
            initialQuery={param(params, "q")?.slice(0, 60) ?? ""}
            initialCategory={initialCategory}
          />
        )}
      </div>
    </>
  );
}

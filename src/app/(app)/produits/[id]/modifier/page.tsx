import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireContext } from "@/server/context";
import { getProductForEdit, listCategories } from "@/server/queries/products";

export const metadata: Metadata = { title: "Modifier le produit" };

export default async function ModifierProduitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext("products.manage");
  if (ctx.plan.readOnly) redirect(`/produits/${id}`);
  const [product, categories] = await Promise.all([getProductForEdit(ctx, id), listCategories(ctx.business.id)]);
  if (!product) notFound();

  return (
    <>
      <PageHeader title="Modifier le produit" description={product.name} backHref={`/produits/${id}`} />
      <ProductForm
        productId={id}
        categories={categories}
        defaults={{
          name: product.name,
          reference: product.reference ?? "",
          unit: product.unit,
          categoryId: product.categoryId,
          salePrice: product.salePrice,
          costPrice: product.costPrice,
          alertThreshold: product.alertThreshold,
          imageData: product.imageData,
        }}
        stock={product.archivedAt ? undefined : { seen: product.physical, locationName: ctx.location.name }}
      />
    </>
  );
}

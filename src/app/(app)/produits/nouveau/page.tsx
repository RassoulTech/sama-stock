import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireContext } from "@/server/context";
import { listCategories } from "@/server/queries/products";

export const metadata: Metadata = { title: "Nouveau produit" };

export default async function NouveauProduitPage() {
  const ctx = await requireContext("products.manage");
  if (ctx.plan.readOnly) redirect("/produits");
  const categories = await listCategories(ctx.business.id);
  return (
    <>
      <PageHeader title="Nouveau produit" backHref="/produits" />
      <ProductForm categories={categories} />
    </>
  );
}

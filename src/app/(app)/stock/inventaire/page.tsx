import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { InventoryForm } from "@/components/stock/inventory-form";
import { requireContext } from "@/server/context";
import { listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Inventaire" };

export default async function InventairePage() {
  const ctx = await requireContext("stock.adjust");
  if (ctx.plan.readOnly) redirect("/stock");
  const products = await listProducts(ctx);

  return (
    <>
      <PageHeader title="Inventaire" description={`Comptage du stock · ${ctx.location.name}`} backHref="/stock" />
      <InventoryForm
        showCost={ctx.can("costs.view")}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          physical: p.physical,
          imageUrl: p.imageUrl,
          categoryName: p.categoryName,
        }))}
      />
    </>
  );
}

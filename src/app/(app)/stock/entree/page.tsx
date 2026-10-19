import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseForm } from "@/components/stock/purchase-form";
import { requireContext } from "@/server/context";
import { toPicker } from "@/server/queries/picker";
import { listProducts } from "@/server/queries/products";
import { listSuppliers } from "@/server/queries/stock";

export const metadata: Metadata = { title: "Entrée de stock" };

export default async function EntreePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext("stock.in");
  if (ctx.plan.readOnly) redirect("/stock");
  const params = await searchParams;
  const [products, suppliers] = await Promise.all([listProducts(ctx), listSuppliers(ctx.business.id)]);

  return (
    <>
      <PageHeader
        title="Entrée de stock"
        description={`Marchandise reçue à ${ctx.location.name}`}
        backHref="/stock"
      />
      <PurchaseForm
        products={toPicker(products)}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        showCost={ctx.can("costs.view")}
        canCreateSupplier={ctx.can("suppliers.manage")}
        initialProductId={typeof params.produit === "string" ? params.produit : undefined}
      />
    </>
  );
}

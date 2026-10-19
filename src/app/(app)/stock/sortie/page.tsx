import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ExitForm } from "@/components/stock/exit-form";
import { requireContext } from "@/server/context";
import { toPicker } from "@/server/queries/picker";
import { listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Sortie ou perte" };

export default async function SortiePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext("stock.adjust");
  if (ctx.plan.readOnly) redirect("/stock");
  const params = await searchParams;
  const products = await listProducts(ctx);
  const physical = new Map(products.map((p) => [p.id, p.physical]));

  return (
    <>
      <PageHeader
        title="Sortie ou perte"
        description="Retirez du stock un produit cassé, volé, périmé, ou sorti sans passer par la caisse."
        backHref="/stock"
      />
      <ExitForm
        products={toPicker(products).map((p) => ({ ...p, physical: physical.get(p.id) ?? 0 }))}
        initialProductId={typeof params.produit === "string" ? params.produit : undefined}
      />
    </>
  );
}

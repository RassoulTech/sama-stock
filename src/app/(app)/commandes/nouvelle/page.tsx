import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrderForm } from "@/components/orders/order-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireContext } from "@/server/context";
import { customerOptions } from "@/server/queries/customers";
import { toPicker } from "@/server/queries/picker";
import { listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Nouvelle commande" };

export default async function NouvelleCommandePage() {
  const ctx = await requireContext("orders.manage");
  if (!ctx.business.moduleOrders || ctx.plan.readOnly) redirect("/commandes");
  const [products, customers] = await Promise.all([listProducts(ctx), customerOptions(ctx.business.id)]);

  return (
    <>
      <PageHeader title="Nouvelle commande" backHref="/commandes" />
      <OrderForm products={toPicker(products)} customers={customers} />
    </>
  );
}

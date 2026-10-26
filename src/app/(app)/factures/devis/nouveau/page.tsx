import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuoteForm } from "@/components/documents/quote-form";
import { PageHeader } from "@/components/shared/page-header";
import { defaultValidUntil } from "@/lib/domain/documents";
import { requireContext } from "@/server/context";
import { customerOptions } from "@/server/queries/customers";
import { toPicker } from "@/server/queries/picker";
import { listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Nouveau devis" };

export default async function NouveauDevisPage() {
  const ctx = await requireContext("sales.create");
  if (ctx.plan.readOnly) redirect("/factures?onglet=devis");
  const [products, customers] = await Promise.all([listProducts(ctx), customerOptions(ctx.business.id)]);
  const validUntil = defaultValidUntil(ctx.business.quoteValidityDays);

  return (
    <>
      <PageHeader title="Nouveau devis" backHref="/factures?onglet=devis" />
      <QuoteForm products={toPicker(products)} customers={customers} defaultValidUntil={validUntil} />
    </>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { QuoteForm } from "@/components/documents/quote-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireContext } from "@/server/context";
import { customerOptions } from "@/server/queries/customers";
import { getDocument } from "@/server/queries/documents";
import { toPicker } from "@/server/queries/picker";
import { listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Modifier le devis" };

export default async function ModifierDevisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext("sales.create");
  const doc = await getDocument(ctx, id);
  if (!doc || doc.type !== "devis") notFound();
  if (doc.status === "converti" || ctx.plan.readOnly) redirect(`/factures/devis/${id}`);
  const [products, customers] = await Promise.all([listProducts(ctx), customerOptions(ctx.business.id)]);
  const picker = toPicker(products);
  const byId = new Map(picker.map((p) => [p.id, p]));

  return (
    <>
      <PageHeader title={`Modifier le devis ${doc.number}`} backHref={`/factures/devis/${id}`} />
      <QuoteForm
        products={picker}
        customers={customers}
        defaultValidUntil={(doc.validUntil ?? new Date()).toISOString().slice(0, 10)}
        initial={{
          id: doc.id,
          customerId: doc.customerId,
          customer: doc.customer,
          // Un produit archivé depuis disparaît du devis modifié
          lines: doc.items.flatMap((i) => {
            const product = i.productId ? byId.get(i.productId) : undefined;
            return product ? [{ product, quantity: i.quantity, unitPrice: i.unitPrice }] : [];
          }),
          discount: doc.discount,
          deliveryFee: doc.deliveryFee,
          validUntil: (doc.validUntil ?? new Date()).toISOString().slice(0, 10),
          note: doc.note,
        }}
      />
    </>
  );
}

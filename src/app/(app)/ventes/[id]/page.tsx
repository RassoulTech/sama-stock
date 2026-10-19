import { CheckCircle2, MessageCircle, Plus, TrendingUp, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/sales/print-button";
import { Receipt } from "@/components/sales/receipt";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/sales";
import { receiptMessage, waLink } from "@/lib/whatsapp";
import { cancelSale } from "@/server/actions/sales";
import { requireContext } from "@/server/context";
import { getSale } from "@/server/queries/sales";

export const metadata: Metadata = { title: "Reçu" };

export default async function VentePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const isNew = (await searchParams).nouvelle === "1";
  const ctx = await requireContext("sales.create");
  const sale = await getSale(ctx, id);
  if (!sale || sale.kind !== "sale") notFound();

  const message = receiptMessage({
    businessName: ctx.business.name,
    number: sale.number,
    date: sale.createdAt,
    items: sale.items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, lineTotal: i.lineTotal })),
    discount: sale.discount,
    deliveryFee: sale.deliveryFee,
    total: sale.total,
    amountPaid: sale.amountPaid,
    paymentLabel: sale.paymentMethod ? (PAYMENT_METHODS[sale.paymentMethod as PaymentMethod] ?? "") : "",
  });

  return (
    <>
      <div className="print:hidden">
        {isNew ? (
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="size-9" />
            </span>
            <h1 className="text-2xl font-semibold">Vente enregistrée !</h1>
            <p className="text-sm text-muted-foreground">Le stock a été mis à jour automatiquement.</p>
          </div>
        ) : (
          <PageHeader title={`Vente ${sale.number}`} backHref="/ventes" />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <Receipt sale={sale} business={ctx.business} />

        <div className="space-y-3 print:hidden">
          {sale.status === "completed" && (
            <Button asChild size="lg" className="w-full bg-[#25D366] text-white hover:bg-[#1fb857]">
              <a href={waLink(sale.customer?.phone, message)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Envoyer sur WhatsApp
              </a>
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <PrintButton />
            {ctx.can("sales.create") && ctx.business.modulePos && !ctx.plan.readOnly && (
              <Button asChild variant={isNew ? "saffron" : "outline"}>
                <Link href="/vendre">
                  <Plus /> Nouvelle vente
                </Link>
              </Button>
            )}
          </div>
          {sale.profit !== null && sale.status === "completed" && (
            <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-accent-foreground">
              <span className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="size-4" /> Bénéfice
              </span>
              <span className="num font-semibold">{formatFCFA(sale.profit)}</span>
            </div>
          )}
          {sale.customer && (
            <Button asChild variant="ghost" className="w-full">
              <Link href={`/clients/${sale.customer.id}`}>Voir la fiche de {sale.customer.name}</Link>
            </Button>
          )}
          {ctx.can("sales.cancel") && sale.status === "completed" && !ctx.plan.readOnly && (
            <ConfirmAction
              trigger={
                <Button variant="destructive" className="w-full">
                  <XCircle /> Annuler la vente
                </Button>
              }
              title={`Annuler la vente ${sale.number} ?`}
              description="Les produits seront remis en stock et la vente ne comptera plus dans le chiffre d'affaires. Cette action est définitive."
              confirmLabel="Annuler la vente"
              destructive
              successMessage="Vente annulée, stock remis à jour"
              action={cancelSale.bind(null, sale.id)}
            />
          )}
        </div>
      </div>
    </>
  );
}

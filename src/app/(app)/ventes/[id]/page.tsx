import { CheckCircle2, CloudOff, FileText, PencilLine, Plus, TrendingUp, TriangleAlert, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateInvoiceDialog } from "@/components/documents/document-actions";
import { DownloadPdfButton, ShareDocumentButton } from "@/components/documents/share-document";
import { PrintButton } from "@/components/sales/print-button";
import { Receipt } from "@/components/sales/receipt";
import { CancelSaleButton, DeleteSaleButton } from "@/components/sales/sale-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { isSyncFlag, SYNC_FLAGS } from "@/lib/domain/offline";
import { correctSaleHref, PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/sales";
import { receiptMessage } from "@/lib/whatsapp";
import { requireContext } from "@/server/context";
import { invoiceOfSale } from "@/server/queries/documents";
import { getSale } from "@/server/queries/sales";
import { pdfPath, verifyUrl } from "@/server/services/documents";

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
  const invoice = await invoiceOfSale(ctx.business.id, sale.id);

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

  const writable = !ctx.plan.readOnly;
  const saleRef = { id: sale.id, number: sale.number, amountPaid: sale.amountPaid };
  const corrections =
    sale.status === "completed" && writable && ctx.can("sales.cancel") ? (
      <>
        {ctx.can("sales.create") && ctx.business.modulePos && (
          <Button asChild variant="outline" className={isNew ? "w-full" : undefined}>
            <Link href={correctSaleHref(sale.id)}>
              <PencilLine /> Corriger la vente
            </Link>
          </Button>
        )}
        <CancelSaleButton sale={saleRef} className={isNew ? "w-full" : undefined} />
      </>
    ) : sale.status === "cancelled" && writable && ctx.can("sales.delete") ? (
      <DeleteSaleButton sale={saleRef} className={isNew ? "w-full" : undefined} />
    ) : null;

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
          <PageHeader title={`Vente ${sale.number}`} backHref="/ventes" actions={corrections} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <Receipt sale={sale} business={ctx.business} />

        <div className="space-y-3 print:hidden">
          {sale.status === "cancelled" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <XCircle className="size-4" /> Vente annulée
              </p>
              {sale.cancelledAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Le {formatDateTime(sale.cancelledAt)}
                  {sale.cancelledByName && <> par {sale.cancelledByName}</>}
                </p>
              )}
              {sale.replacedBy && (
                <Link href={`/ventes/${sale.replacedBy.id}`} className="mt-2 inline-block font-medium text-primary hover:underline">
                  Remplacée par la vente {sale.replacedBy.number}
                </Link>
              )}
            </div>
          )}
          {sale.replaces && (
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <PencilLine className="size-4 text-muted-foreground" /> Vente corrigée
              </p>
              <Link href={`/ventes/${sale.replaces.id}`} className="mt-1 inline-block text-primary hover:underline">
                Remplace la vente {sale.replaces.number}
              </Link>
            </div>
          )}
          {sale.offlineSyncedAt && (
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <CloudOff className="size-4 text-muted-foreground" /> Vendue sans internet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Envoyée le {formatDateTime(sale.offlineSyncedAt)}</p>
              {sale.syncFlags.filter(isSyncFlag).map((f) => (
                <div key={f} className="mt-3 rounded-lg bg-saffron/10 p-3">
                  <p className="flex items-center gap-1.5 font-medium text-warning dark:text-saffron">
                    <TriangleAlert className="size-4" /> {SYNC_FLAGS[f].label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{SYNC_FLAGS[f].text}</p>
                </div>
              ))}
            </div>
          )}
          {sale.status === "completed" && (
            <ShareDocumentButton
              pdfUrl={pdfPath("recu", sale.id)}
              verifyUrl={verifyUrl("recu", sale.id)}
              fileName={`Recu-${sale.number}.pdf`}
              phone={sale.customer?.phone}
              message={message}
              label="Envoyer le reçu (PDF)"
            />
          )}
          {invoice ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/factures/${invoice.id}`}>
                <FileText /> Voir la facture {invoice.number}
              </Link>
            </Button>
          ) : (
            sale.status === "completed" && writable && <CreateInvoiceDialog saleId={sale.id} customer={sale.customer} />
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <DownloadPdfButton pdfUrl={pdfPath("recu", sale.id)} label="Reçu PDF" />
            <PrintButton label="Imprimer" />
            {ctx.can("sales.create") && ctx.business.modulePos && writable && (
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
          {isNew && corrections && <div className="grid gap-3 pt-2">{corrections}</div>}
        </div>
      </div>
    </>
  );
}

import { ExternalLink, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConvertQuoteDialog, QuoteStatusButtons } from "@/components/documents/document-actions";
import { DocumentView } from "@/components/documents/document-view";
import { DownloadPdfButton, ShareDocumentButton } from "@/components/documents/share-document";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { quoteDisplayStatus, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from "@/lib/domain/documents";
import { documentMessage } from "@/lib/whatsapp";
import { requireContext } from "@/server/context";
import { getDocument } from "@/server/queries/documents";
import { pdfPath, verifyUrl } from "@/server/services/documents";

export const metadata: Metadata = { title: "Devis" };

export default async function DevisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext("sales.create");
  const doc = await getDocument(ctx, id);
  if (!doc || doc.type !== "devis") notFound();

  const status = quoteDisplayStatus(doc.status, doc.validUntil);
  const converted = doc.status === "converti";
  const writable = !ctx.plan.readOnly;

  return (
    <>
      <PageHeader
        backHref="/factures?onglet=devis"
        title={
          <span className="flex flex-wrap items-center gap-3">
            Devis {doc.number} <StatusPill tone={QUOTE_STATUS_TONES[status]}>{QUOTE_STATUS_LABELS[status]}</StatusPill>
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <DocumentView doc={doc} logo={ctx.business.logo} paid={null} />
        <div className="space-y-3">
          <ShareDocumentButton
            pdfUrl={pdfPath("devis", doc.id)}
            verifyUrl={verifyUrl("devis", doc.id)}
            fileName={`${doc.number}.pdf`}
            phone={doc.customer.phone}
            message={documentMessage({
              businessName: ctx.business.name,
              kind: "devis",
              number: doc.number,
              date: doc.createdAt,
              total: doc.total,
              validUntil: doc.validUntil,
            })}
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <DownloadPdfButton pdfUrl={pdfPath("devis", doc.id)} />
            <Button asChild variant="outline">
              <a href={pdfPath("devis", doc.id)} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Voir le PDF
              </a>
            </Button>
          </div>

          {converted && doc.sale ? (
            <Button asChild variant="ghost" className="w-full">
              <Link href={`/ventes/${doc.sale.id}`}>Voir la vente {doc.sale.number}</Link>
            </Button>
          ) : (
            writable && (
              <>
                {ctx.business.modulePos && doc.status !== "refuse" && (
                  <ConvertQuoteDialog id={doc.id} total={doc.total} hasCustomer={Boolean(doc.customerId)} />
                )}
                <QuoteStatusButtons id={doc.id} status={doc.status} />
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/factures/devis/${doc.id}/modifier`}>
                    <Pencil /> Modifier le devis
                  </Link>
                </Button>
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}

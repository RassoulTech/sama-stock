import { ExternalLink, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/documents/document-view";
import { DownloadPdfButton, ShareDocumentButton } from "@/components/documents/share-document";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { documentMessage } from "@/lib/whatsapp";
import { cancelInvoice } from "@/server/actions/documents";
import { requireContext } from "@/server/context";
import { getDocument } from "@/server/queries/documents";
import { pdfPath, verifyUrl } from "@/server/services/documents";

export const metadata: Metadata = { title: "Facture" };

export default async function FacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext("sales.create");
  const doc = await getDocument(ctx, id);
  if (!doc || doc.type !== "facture") notFound();

  const cancelled = doc.status === "annulee";
  const paid = doc.sale ? Math.min(doc.sale.amountPaid, doc.total) : null;
  const rest = paid === null ? 0 : doc.total - paid;
  const saleHref = doc.sale ? (doc.sale.kind === "order" ? `/commandes/${doc.sale.id}` : `/ventes/${doc.sale.id}`) : null;

  return (
    <>
      <PageHeader
        backHref="/factures"
        title={
          <span className="flex flex-wrap items-center gap-3">
            Facture {doc.number} {cancelled && <StatusPill tone="red">Annulée</StatusPill>}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <DocumentView doc={doc} logo={ctx.business.logo} paid={cancelled ? null : paid} />
        <div className="space-y-3">
          {!cancelled && (
            <ShareDocumentButton
              pdfUrl={pdfPath("facture", doc.id)}
              verifyUrl={verifyUrl("facture", doc.id)}
              fileName={`${doc.number}.pdf`}
              phone={doc.customer.phone}
              message={documentMessage({ businessName: ctx.business.name, kind: "facture", number: doc.number, date: doc.createdAt, total: doc.total, rest })}
            />
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <DownloadPdfButton pdfUrl={pdfPath("facture", doc.id)} />
            <Button asChild variant="outline">
              <a href={pdfPath("facture", doc.id)} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Voir le PDF
              </a>
            </Button>
          </div>
          {saleHref && (
            <Button asChild variant="ghost" className="w-full">
              <Link href={saleHref}>
                Voir la {doc.sale!.kind === "order" ? "commande" : "vente"} {doc.sale!.number}
              </Link>
            </Button>
          )}
          {!cancelled && rest > 0 && doc.customerId && (
            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              Quand le client paie le reste, enregistrez-le sur sa fiche (Clients et crédits) : la facture se met à jour toute seule.
            </p>
          )}
          {!cancelled && ctx.can("sales.cancel") && !ctx.plan.readOnly && (
            <ConfirmAction
              trigger={
                <Button variant="destructive" className="w-full">
                  <XCircle /> Annuler la facture
                </Button>
              }
              title={`Annuler la facture ${doc.number} ?`}
              description="La facture reste dans la liste, marquée « Annulée », et son numéro n'est jamais réutilisé. La vente n'est pas touchée : vous pourrez refaire une facture."
              confirmLabel="Annuler la facture"
              destructive
              successMessage="Facture annulée"
              action={cancelInvoice.bind(null, doc.id)}
            />
          )}
        </div>
      </div>
    </>
  );
}

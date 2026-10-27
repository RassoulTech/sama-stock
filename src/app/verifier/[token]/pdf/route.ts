import { isLicenceDocKind } from "@/lib/domain/document-token";
import { readDocumentToken, verifyUrl } from "@/server/services/documents";
import { getPublicDocument } from "@/server/queries/documents";
import { getLicenseSale } from "@/server/queries/licences";
import { renderDocumentPdf } from "@/server/pdf/document-pdf";
import { renderLicencePdf } from "@/server/pdf/licence-pdf";

const notFound = () => new Response("Document introuvable", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** PDF d'un devis, d'une facture ou d'un reçu (ou d'une licence Sama Stock), par son lien signé. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ref = readDocumentToken(token);
  if (!ref) return notFound();

  let pdf: Buffer;
  let fileName: string;
  if (isLicenceDocKind(ref.kind)) {
    const detail = await getLicenseSale(ref.id);
    if (!detail) return notFound();
    const kind = ref.kind === "licence_facture" ? "facture" : "devis";
    pdf = await renderLicencePdf(detail, kind, verifyUrl(ref.kind, ref.id));
    fileName = `${kind === "facture" ? "Facture" : "Devis"}-${detail.sale.number}`;
  } else {
    const doc = await getPublicDocument(ref.kind, ref.id);
    if (!doc) return notFound();
    pdf = await renderDocumentPdf(doc, verifyUrl(ref.kind, ref.id));
    fileName = doc.number;
  }

  const download = new URL(request.url).searchParams.has("telecharger");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}.pdf"`,
      // Le paiement d'une facture peut changer : toujours la version du moment
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

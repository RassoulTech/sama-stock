import { readDocumentToken, verifyUrl } from "@/server/services/documents";
import { getPublicDocument } from "@/server/queries/documents";
import { renderDocumentPdf } from "@/server/pdf/document-pdf";

/** PDF d'un devis, d'une facture ou d'un reçu, par son lien signé (le même pour la boutique et pour son client). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ref = readDocumentToken(token);
  const doc = ref ? await getPublicDocument(ref.kind, ref.id) : null;
  if (!ref || !doc) return new Response("Document introuvable", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const pdf = await renderDocumentPdf(doc, verifyUrl(ref.kind, ref.id));
  const download = new URL(request.url).searchParams.has("telecharger");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.number}.pdf"`,
      // Le paiement d'une facture peut changer : toujours la version du moment
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

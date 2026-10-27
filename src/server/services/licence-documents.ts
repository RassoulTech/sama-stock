import "server-only";
import { isLicensePack, LICENSE_PACKS } from "@/lib/domain/plans";
import { licenceDocumentMessage } from "@/lib/whatsapp";
import type { LicenseSaleRow } from "../queries/licences";
import { pdfPath, verifyUrl } from "./documents";

export type LicenceDoc = "facture" | "devis";

/** Tout ce qu'il faut pour envoyer la facture (ou le devis) d'une licence sur WhatsApp, en PDF. */
export function licenceShare(sale: LicenseSaleRow, kind: LicenceDoc) {
  const docKind = kind === "facture" ? "licence_facture" : "licence_devis";
  return {
    pdfUrl: pdfPath(docKind, sale.id),
    verifyUrl: verifyUrl(docKind, sale.id),
    fileName: `${kind === "facture" ? "Facture" : "Devis"}-${sale.number}.pdf`,
    phone: sale.phone,
    message: licenceDocumentMessage({
      kind,
      number: sale.number,
      ownerName: sale.owner_name,
      businessName: sale.business,
      packLabel: isLicensePack(sale.pack) ? LICENSE_PACKS[sale.pack].label : sale.pack,
      total: sale.agreed_price,
      paid: sale.paid_licence,
    }),
  };
}

export type LicenceShare = ReturnType<typeof licenceShare>;

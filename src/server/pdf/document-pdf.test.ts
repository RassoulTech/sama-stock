import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { PublicDocument } from "../queries/documents";

vi.mock("server-only", () => ({}));
const { pdfText, renderDocumentPdf } = await import("./document-pdf");

const base: PublicDocument = {
  kind: "facture",
  id: "3a98e720-97da-49b4-897b-aa36dd00a73b",
  number: "FAC-2026-0001",
  date: new Date("2026-10-26T10:00:00Z"),
  validUntil: null,
  status: "emise",
  seller: { name: "Quincaillerie Ndiaye & Fils", phone: "+221771234567", address: "Avenue Blaise Diagne", city: "Dakar", ninea: "0012345 2G3", rccm: "SN DKR 2024 A 12345" },
  logo: null,
  brandColor: null,
  customer: { name: "Entreprise Diallo BTP", phone: "+221781112233", address: "Thiès", ninea: "0098765 1A2" },
  sellerName: null,
  lines: [
    { name: "Ciment CEM II 42,5 (sac 50 kg)", unit: "sac", quantity: 20, unitPrice: 4_250, lineTotal: 85_000 },
    { name: "Fer à béton 10 mm", unit: "piece", quantity: 12, unitPrice: 3_500, lineTotal: 42_000 },
    { name: "Peinture à eau « Blanc cassé »", unit: "l", quantity: 2.5, unitPrice: 2_000, lineTotal: 5_000 },
  ],
  subtotal: 132_000,
  discount: 2_000,
  deliveryFee: 5_000,
  total: 135_000,
  vatRate: 0,
  payment: { paid: 100_000, method: "wave", cancelled: false },
  note: null,
  footer: "Paiement par Wave ou Orange Money au 77 123 45 67. Merci pour votre confiance !",
};

describe("PDF des documents", () => {
  it("nettoie les caractères absents de la police intégrée", () => {
    expect(pdfText("135 000 FCFA")).toBe("135 000 FCFA");
    expect(pdfText("−2 000")).toBe("-2 000");
    expect(pdfText("Reçu « été » 😀")).toBe("Reçu « été » ");
  });

  it.each([
    ["facture", base],
    ["facture avec TVA", { ...base, vatRate: 18 }],
    ["devis", { ...base, kind: "devis", number: "DEV-2026-0001", status: "en_cours", validUntil: new Date("2026-11-10T23:59:59Z"), payment: null, note: "Livraison sous 48 h." }],
    ["reçu", { ...base, kind: "recu", number: "V-0042", status: "completed", customer: null, sellerName: "Awa Ndiaye" }],
    ["facture annulée", { ...base, status: "annulee" }],
  ] as [string, PublicDocument][])("%s : un vrai fichier PDF", async (_label, doc) => {
    const pdf = await renderDocumentPdf(doc, `https://sama-stock-one.vercel.app/verifier/f.${doc.id}.abc`);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
    // Pour regarder le rendu : PDF_PREVIEW_DIR=<dossier> npx vitest run src/server/pdf
    if (process.env.PDF_PREVIEW_DIR) writeFileSync(`${process.env.PDF_PREVIEW_DIR}/${doc.kind}-${doc.vatRate}-${doc.status}.pdf`, pdf);
  });
});

import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { licenceDocumentMessage } from "@/lib/whatsapp";
import type { LicenseSaleRow } from "../queries/licences";

vi.mock("server-only", () => ({}));
const { renderLicencePdf } = await import("./licence-pdf");

const sale: LicenseSaleRow = {
  id: "8c1f2a4e-5b6d-4e7f-9a0b-1c2d3e4f5a6b",
  number: "SS-2026-0004",
  pack: "pro",
  list_price: 75_000,
  agreed_price: 70_000,
  maintenance_price: 20_000,
  status: "active",
  note: null,
  created_at: new Date("2026-10-27T09:00:00Z"),
  cancelled_at: null,
  business_id: "b1",
  business: "Sénégal Sanitary Ware",
  city: "Dakar",
  phone: "+221771234567",
  logo: null,
  brand_color: null,
  activated_at: new Date("2026-10-27T09:00:00Z"),
  maintenance_ends_at: new Date("2027-10-27T09:00:00Z"),
  owner_name: "Moussa Diop",
  owner_email: "moussa@exemple.sn",
  paid_licence: 35_000,
  paid_maintenance: 0,
  last_payment: new Date("2026-10-27T09:00:00Z"),
};
const payments = [{ id: "p1", kind: "licence", amount: 35_000, method: "wave", note: "Acompte", paid_at: new Date("2026-10-27T09:00:00Z"), recorded_by: null }];

describe("PDF de la licence", () => {
  it.each([
    ["facture", { sale, payments }],
    ["devis", { sale, payments }],
    ["facture soldée", { sale: { ...sale, paid_licence: 70_000 }, payments: [...payments, { ...payments[0]!, id: "p2", note: "Solde" }] }],
    ["facture annulée", { sale: { ...sale, status: "annulee" }, payments }],
  ] as const)("%s : un vrai fichier PDF", async (label, detail) => {
    const kind = label.startsWith("devis") ? "devis" : "facture";
    const pdf = await renderLicencePdf(detail as never, kind, `https://sama-stock-one.vercel.app/verifier/lf.${sale.id}.abc`);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
    // Pour regarder le rendu : PDF_PREVIEW_DIR=<dossier> npx vitest run src/server/pdf
    if (process.env.PDF_PREVIEW_DIR) writeFileSync(`${process.env.PDF_PREVIEW_DIR}/licence-${label.replace(/ /g, "-")}.pdf`, pdf);
  });

  it("prépare le message WhatsApp qui accompagne la facture", () => {
    const text = licenceDocumentMessage({ kind: "facture", number: "SS-2026-0004", ownerName: "Moussa Diop", businessName: "SSW", packLabel: "Pro", total: 70_000, paid: 35_000 });
    expect(text).toMatch(/^Bonjour Moussa,/);
    expect(text).toContain("la facture N° SS-2026-0004");
    expect(text).toMatch(/Reste à payer : 35\s000 FCFA/);
    const paid = licenceDocumentMessage({ kind: "facture", number: "SS-2026-0004", ownerName: null, businessName: "SSW", packLabel: "Pro", total: 70_000, paid: 70_000 });
    expect(paid).toMatch(/^Bonjour,/);
    expect(paid).toContain("Entièrement payée");
  });
});

/* eslint-disable jsx-a11y/alt-text -- Image de @react-pdf/renderer (dessin dans le PDF), pas une balise <img> */
import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { BRAND_COLORS, isBrandColor } from "@/lib/domain/brand";
import { amountSentence, vatBreakdown } from "@/lib/domain/documents";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/sales";
import { formatDate, formatDateTime, formatFCFA, formatNumber, formatPhone, formatQty } from "@/lib/format";
import type { PublicDocument } from "../queries/documents";

const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Helvetica intégrée (WinAnsi) : espaces fines des montants et signe moins remplacés, le reste ôté. */
export function pdfText(value: string): string {
  return value
    .replace(/[   ]/g, " ")
    .replace(/−/g, "-")
    .replace(/[^\n\x20-\xFF]/g, (c) => (WIN_ANSI_EXTRA.has(c) ? c : ""));
}

const money = (n: number) => pdfText(formatFCFA(n));
const TITLES = { facture: "FACTURE", devis: "DEVIS", recu: "REÇU" } as const;
const INK = "#0b1310";
const MUTED = "#58635e";
const LINE = "#e5e8e5";
const SOFT = "#f3f5f3";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, color: INK, paddingTop: 36, paddingBottom: 70, paddingHorizontal: 40, lineHeight: 1.35 },
  row: { flexDirection: "row" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED },
  small: { fontSize: 8 },
  box: { backgroundColor: SOFT, borderRadius: 4, padding: 10 },
  label: { fontSize: 7.5, color: MUTED, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, marginBottom: 3 },
  th: { color: "#ffffff", fontFamily: "Helvetica-Bold", paddingVertical: 5, paddingHorizontal: 6 },
  td: { paddingVertical: 5, paddingHorizontal: 6 },
  right: { textAlign: "right" },
});

function Party({ title, party }: { title: string; party: { name: string; phone?: string | null; address?: string | null; city?: string | null; ninea?: string | null } }) {
  return (
    <View style={[styles.box, { flex: 1 }]}>
      <Text style={styles.label}>{title}</Text>
      <Text style={[styles.bold, { fontSize: 10.5, lineHeight: 1.3 }]}>{pdfText(party.name)}</Text>
      {party.phone && <Text>{pdfText(formatPhone(party.phone))}</Text>}
      {(party.address || party.city) && <Text>{pdfText([party.address, party.city].filter(Boolean).join(", "))}</Text>}
      {party.ninea && <Text>NINEA {pdfText(party.ninea)}</Text>}
    </View>
  );
}

function TotalRow({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <View style={[styles.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
      <Text style={strong ? { fontFamily: "Helvetica-Bold", fontSize: 11, lineHeight: 1.3 } : styles.muted}>{pdfText(label)}</Text>
      <Text style={{ ...(strong ? { fontFamily: "Helvetica-Bold", fontSize: 11, lineHeight: 1.3 } : {}), ...(color ? { color } : {}) }}>{value}</Text>
    </View>
  );
}

export function DocumentPdf({ doc, verifyUrl, qr }: { doc: PublicDocument; verifyUrl: string; qr: string }) {
  const brand = isBrandColor(doc.brandColor) ? BRAND_COLORS[doc.brandColor].primary : BRAND_COLORS.vert.primary;
  const receipt = doc.kind === "recu";
  const vat = doc.vatRate > 0 ? vatBreakdown(doc.lines, doc.discount, doc.deliveryFee, doc.vatRate) : null;
  const cancelled = doc.status === "annulee" || doc.status === "cancelled" || Boolean(doc.payment?.cancelled);
  const rest = doc.payment ? Math.max(0, doc.total - doc.payment.paid) : 0;
  const method = doc.payment?.method ? (PAYMENT_METHODS[doc.payment.method as PaymentMethod] ?? null) : null;
  const logo = doc.logo && /^data:image\/(jpeg|jpg|png);base64,/.test(doc.logo) ? doc.logo : null;
  const seller = doc.seller;
  const legal = [seller.ninea && `NINEA ${seller.ninea}`, seller.rccm && `RCCM ${seller.rccm}`].filter(Boolean).join(" · ");
  const colWidths = receipt ? ["52%", "14%", "17%", "17%"] : ["50%", "12%", "19%", "19%"];

  return (
    <Document title={`${TITLES[doc.kind]} ${doc.number}`} author={pdfText(seller.name)} creator="Sama Stock" producer="Sama Stock">
      <Page size={receipt ? "A5" : "A4"} style={[styles.page, receipt ? { paddingHorizontal: 28, paddingTop: 28, fontSize: 9 } : {}]}>
        {/* En-tête : boutique à gauche, type et numéro à droite */}
        <View style={[styles.row, { justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: brand, paddingBottom: 12 }]}>
          <View style={[styles.row, { gap: 10, flex: 1, paddingRight: 12 }]}>
            {logo && <Image src={logo} style={{ width: receipt ? 40 : 52, height: receipt ? 40 : 52, borderRadius: 6, objectFit: "cover" }} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.bold, { fontSize: receipt ? 12 : 14, lineHeight: 1.25, marginBottom: 2 }]}>{pdfText(seller.name)}</Text>
              {(seller.address || seller.city) && <Text style={styles.muted}>{pdfText([seller.address, seller.city].filter(Boolean).join(", "))}</Text>}
              {seller.phone && <Text style={styles.muted}>Tél. {pdfText(formatPhone(seller.phone))}</Text>}
              {legal && <Text style={[styles.muted, styles.small]}>{pdfText(legal)}</Text>}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.bold, { fontSize: receipt ? 16 : 20, lineHeight: 1.2, color: brand, letterSpacing: 1, marginBottom: 2 }]}>{TITLES[doc.kind]}</Text>
            <Text style={styles.bold}>N° {doc.number}</Text>
            <Text style={styles.muted}>{pdfText(receipt ? formatDateTime(doc.date) : `du ${formatDate(doc.date)}`)}</Text>
            {doc.kind === "devis" && doc.validUntil && <Text style={styles.muted}>{pdfText(`valable jusqu'au ${formatDate(doc.validUntil)}`)}</Text>}
          </View>
        </View>

        {/* Client */}
        {(doc.customer || doc.sellerName) && (
          <View style={[styles.row, { gap: 10, marginTop: 12 }]}>
            {doc.customer && <Party title={doc.kind === "facture" ? "FACTURÉ À" : "CLIENT"} party={doc.customer} />}
            {receipt && doc.sellerName && (
              <View style={[styles.box, { flex: doc.customer ? 0.7 : 1 }]}>
                <Text style={styles.label}>VENDEUR</Text>
                <Text>{pdfText(doc.sellerName)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Lignes */}
        <View style={{ marginTop: 14 }}>
          <View style={[styles.row, { backgroundColor: brand, borderRadius: 3 }]}>
            <Text style={[styles.th, { width: colWidths[0] }]}>Désignation</Text>
            <Text style={[styles.th, styles.right, { width: colWidths[1] }]}>Qté</Text>
            <Text style={[styles.th, styles.right, { width: colWidths[2] }]}>{vat ? "PU HT" : receipt ? "P.U." : "Prix unitaire"}</Text>
            <Text style={[styles.th, styles.right, { width: colWidths[3] }]}>{vat ? "Total HT" : "Total"}</Text>
          </View>
          {doc.lines.map((l, i) => (
            <View key={i} style={[styles.row, { borderBottomWidth: 1, borderBottomColor: LINE }]} wrap={false}>
              <Text style={[styles.td, { width: colWidths[0] }]}>{pdfText(l.name)}</Text>
              <Text style={[styles.td, styles.right, { width: colWidths[1] }]}>{pdfText(formatQty(l.quantity, l.unit))}</Text>
              <Text style={[styles.td, styles.right, { width: colWidths[2] }]}>
                {pdfText(formatNumber(vat ? Math.round(l.unitPrice / (1 + doc.vatRate / 100)) : l.unitPrice))}
              </Text>
              <Text style={[styles.td, styles.right, { width: colWidths[3] }]}>{pdfText(formatNumber(vat ? vat.linesHT[i]! : l.lineTotal))}</Text>
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={[styles.row, { justifyContent: "flex-end", marginTop: 10 }]} wrap={false}>
          <View style={{ width: receipt ? "62%" : "45%" }}>
            {vat ? (
              <>
                {doc.discount > 0 && <TotalRow label="Remise HT" value={`-${money(vat.discountHT)}`} />}
                {doc.deliveryFee > 0 && <TotalRow label="Livraison HT" value={money(vat.deliveryHT)} />}
                <TotalRow label="Total HT" value={money(vat.totalHT)} />
                <TotalRow label={`TVA ${doc.vatRate} %`} value={money(vat.vat)} />
                <View style={{ borderTopWidth: 1, borderTopColor: LINE, marginTop: 3, paddingTop: 3 }}>
                  <TotalRow label="Total TTC" value={money(doc.total)} strong />
                </View>
              </>
            ) : (
              <>
                {(doc.discount > 0 || doc.deliveryFee > 0) && <TotalRow label="Sous-total" value={money(doc.subtotal)} />}
                {doc.discount > 0 && <TotalRow label="Remise" value={`-${money(doc.discount)}`} />}
                {doc.deliveryFee > 0 && <TotalRow label="Livraison" value={money(doc.deliveryFee)} />}
                <View style={{ borderTopWidth: 1, borderTopColor: LINE, marginTop: 3, paddingTop: 3 }}>
                  <TotalRow label="Total" value={money(doc.total)} strong />
                </View>
              </>
            )}
            {doc.payment && !cancelled && (
              <View style={[styles.box, { marginTop: 6, padding: 7 }]}>
                <TotalRow label={`Payé${method && doc.payment.paid > 0 ? ` (${method})` : ""}`} value={money(doc.payment.paid)} />
                <TotalRow label="Reste à payer" value={rest > 0 ? money(rest) : "Soldé"} strong color={rest > 0 ? "#b45309" : "#15803d"} />
              </View>
            )}
          </View>
        </View>

        <Text style={{ marginTop: 10, fontFamily: "Helvetica-Oblique" }}>{pdfText(amountSentence(doc.kind, doc.total, formatNumber(doc.total)))}</Text>
        {!vat && !receipt && <Text style={[styles.muted, { marginTop: 3 }]}>Non assujetti à la TVA.</Text>}
        {doc.note && (
          <View style={[styles.box, { marginTop: 10 }]}>
            <Text style={styles.label}>NOTE</Text>
            <Text>{pdfText(doc.note)}</Text>
          </View>
        )}
        {doc.footer && <Text style={[styles.muted, { marginTop: 10 }]}>{pdfText(doc.footer)}</Text>}

        {doc.kind === "devis" && (
          <View style={[styles.row, { gap: 14, marginTop: 18 }]} wrap={false}>
            <View style={{ flex: 1, height: 64, borderWidth: 1, borderStyle: "dashed", borderColor: "#c9cec9", borderRadius: 4, padding: 7 }}>
              <Text style={styles.muted}>Pour {pdfText(seller.name)}</Text>
            </View>
            <View style={{ flex: 1, height: 64, borderWidth: 1, borderStyle: "dashed", borderColor: "#c9cec9", borderRadius: 4, padding: 7 }}>
              <Text style={styles.muted}>Bon pour accord : date et signature du client</Text>
            </View>
          </View>
        )}

        {/* Vérification et pied de page, en bas de chaque page */}
        <View fixed style={[styles.row, { position: "absolute", bottom: 14, left: receipt ? 28 : 40, right: receipt ? 28 : 40, alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }]}>
          <Image src={qr} style={{ width: 46, height: 46 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.small}>Scannez ce code pour vérifier ce document :</Text>
            <Text style={[styles.small, styles.muted]}>{verifyUrl}</Text>
            <Text style={[styles.small, styles.muted]}>Document généré avec Sama Stock</Text>
          </View>
        </View>

        {cancelled && (
          <View fixed style={{ position: "absolute", top: receipt ? 230 : 330, left: 0, right: 0, alignItems: "center" }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: receipt ? 44 : 64, lineHeight: 1.2, color: "#dc2626", opacity: 0.25, transform: "rotate(-18deg)" }}>ANNULÉ{doc.kind === "facture" ? "E" : ""}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function renderDocumentPdf(doc: PublicDocument, verifyUrl: string): Promise<Buffer> {
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 220, errorCorrectionLevel: "M" });
  return renderToBuffer(<DocumentPdf doc={doc} verifyUrl={verifyUrl} qr={qr} />);
}

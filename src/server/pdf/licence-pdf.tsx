/* eslint-disable jsx-a11y/alt-text -- Image de @react-pdf/renderer (dessin dans le PDF), pas une balise <img> */
import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { amountSentence } from "@/lib/domain/documents";
import { isLicensePack, LICENSE_PACKS, MAINTENANCE_INCLUDED_MONTHS } from "@/lib/domain/plans";
import { formatDate, formatFCFA, formatNumber, formatPhone } from "@/lib/format";
import { LEGAL } from "@/lib/legal";
import { balanceOf, type getLicenseSale } from "../queries/licences";
import { pdfText } from "./document-pdf";

type Detail = NonNullable<Awaited<ReturnType<typeof getLicenseSale>>>;
export type LicenceDoc = "facture" | "devis";

const GREEN = "#0b6e4f";
const INK = "#0b1310";
const MUTED = "#58635e";
const LINE = "#e5e8e5";
const SOFT = "#f3f5f3";
const money = (n: number) => pdfText(formatFCFA(n));
const method = (m: string) => LICENSE_PAYMENT_METHODS[m as LicensePaymentMethod] ?? m;

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, color: INK, paddingTop: 36, paddingBottom: 72, paddingHorizontal: 40, lineHeight: 1.35 },
  row: { flexDirection: "row" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: MUTED },
  small: { fontSize: 8 },
  box: { backgroundColor: SOFT, borderRadius: 4, padding: 10 },
  label: { fontSize: 7.5, color: MUTED, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, marginBottom: 3 },
  th: { color: "#ffffff", fontFamily: "Helvetica-Bold", paddingVertical: 5, paddingHorizontal: 6 },
  td: { paddingVertical: 6, paddingHorizontal: 6 },
  right: { textAlign: "right" },
  line: { borderBottomWidth: 1, borderBottomColor: LINE },
});

function Line({ title, detail, amount, muted }: { title: string; detail?: string; amount: string; muted?: boolean }) {
  return (
    <View style={[s.row, s.line]} wrap={false}>
      <View style={[s.td, { width: "75%" }]}>
        <Text style={s.bold}>{pdfText(title)}</Text>
        {detail && <Text style={s.muted}>{pdfText(detail)}</Text>}
      </View>
      <Text style={[s.td, s.right, { width: "25%" }, muted ? s.muted : {}]}>{amount}</Text>
    </View>
  );
}

function Amount({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  const big = strong ? { fontFamily: "Helvetica-Bold", fontSize: 11, lineHeight: 1.3 } : {};
  return (
    <View style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
      <Text style={strong ? big : s.muted}>{pdfText(label)}</Text>
      <Text style={{ ...big, ...(color ? { color } : {}) }}>{value}</Text>
    </View>
  );
}

/** Facture ou devis d'une licence Sama Stock (même contenu que la page à imprimer de l'administration). */
export function LicencePdf({ detail, kind, verifyUrl, qr }: { detail: Detail; kind: LicenceDoc; verifyUrl: string; qr: string }) {
  const { sale, payments } = detail;
  const pack = isLicensePack(sale.pack) ? LICENSE_PACKS[sale.pack] : null;
  const discount = sale.list_price - sale.agreed_price;
  const rest = balanceOf(sale);
  const licencePayments = payments.filter((p) => p.kind === "licence");
  const maintenancePayments = payments.filter((p) => p.kind === "maintenance");
  const cancelled = sale.status !== "active";
  const title = kind === "facture" ? "FACTURE" : "DEVIS";

  return (
    <Document title={`${title} ${sale.number}`} author={LEGAL.editor} creator="Sama Stock" producer="Sama Stock">
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 12 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[s.bold, { fontSize: 16, color: GREEN, lineHeight: 1.2 }]}>Sama Stock</Text>
            <Text style={[s.bold, { marginTop: 2 }]}>{pdfText(LEGAL.editor)}</Text>
            <Text style={s.muted}>{pdfText(`${LEGAL.city} · Tél. ${LEGAL.phone} · ${LEGAL.email}`)}</Text>
            <Text style={[s.muted, s.small]}>{pdfText(`NINEA ${LEGAL.ninea} · RCCM ${LEGAL.rccm}`)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.bold, { fontSize: 20, lineHeight: 1.2, color: GREEN, letterSpacing: 1, marginBottom: 2 }]}>{title}</Text>
            <Text style={s.bold}>N° {sale.number}</Text>
            <Text style={s.muted}>{pdfText(`du ${formatDate(sale.created_at)}`)}</Text>
            {kind === "devis" && <Text style={s.muted}>valable 30 jours</Text>}
          </View>
        </View>

        <View style={[s.row, { gap: 10, marginTop: 12 }]}>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>{kind === "facture" ? "FACTURÉ À" : "CLIENT"}</Text>
            <Text style={[s.bold, { fontSize: 10.5, lineHeight: 1.3 }]}>{pdfText(sale.business)}</Text>
            {sale.owner_name && <Text>{pdfText(sale.owner_name)}</Text>}
            {sale.city && <Text>{pdfText(sale.city)}</Text>}
            {sale.phone && <Text>{pdfText(formatPhone(sale.phone))}</Text>}
            {sale.owner_email && <Text>{pdfText(sale.owner_email)}</Text>}
          </View>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>OBJET</Text>
            <Text style={s.bold}>Application Sama Stock à votre nom</Text>
            <Text>
              {pdfText("Gestion du stock, des ventes, des commandes et des crédits clients, installée et personnalisée pour votre commerce.")}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={[s.row, { backgroundColor: GREEN, borderRadius: 3 }]}>
            <Text style={[s.th, { width: "75%" }]}>Désignation</Text>
            <Text style={[s.th, s.right, { width: "25%" }]}>Montant</Text>
          </View>
          <Line
            title={`Licence Sama Stock - forfait ${pack?.label ?? sale.pack}`}
            detail={`Utilisation à vie${pack ? ` · ${pack.tagline.toLowerCase()}` : ""}`}
            amount={money(sale.list_price)}
          />
          <Line title="Installation et personnalisation" detail="Création de votre application, logo et couleur, import de vos produits, formation" amount="Inclus" muted />
          <Line title={`Maintenance pendant ${MAINTENANCE_INCLUDED_MONTHS} mois`} detail="Assistance, nouveautés et sauvegardes" amount="Inclus" muted />
          {discount > 0 && <Line title="Remise accordée" amount={`-${money(discount)}`} />}
        </View>

        <View style={[s.row, { justifyContent: "flex-end", marginTop: 10 }]} wrap={false}>
          <View style={{ width: "45%" }}>
            <Amount label="Montant à payer" value={money(sale.agreed_price)} strong />
            {kind === "facture" && !cancelled && (
              <View style={[s.box, { marginTop: 6, padding: 7 }]}>
                <Amount label="Total payé" value={money(sale.paid_licence)} />
                <Amount label="Reste à payer" value={rest > 0 ? money(rest) : "Soldé"} strong color={rest > 0 ? "#b45309" : "#15803d"} />
              </View>
            )}
          </View>
        </View>
        <Text style={{ marginTop: 10, fontFamily: "Helvetica-Oblique" }}>
          {pdfText(amountSentence(kind, sale.agreed_price, formatNumber(sale.agreed_price)))}
        </Text>

        {kind === "facture" && (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={[s.bold, { marginBottom: 4 }]}>Paiements reçus</Text>
            {licencePayments.length === 0 ? (
              <Text style={s.muted}>Aucun paiement reçu pour l&apos;instant.</Text>
            ) : (
              licencePayments.map((p) => (
                <View key={p.id} style={[s.row, s.line, { paddingVertical: 4 }]}>
                  <Text style={{ width: "75%" }}>{pdfText(`${formatDate(p.paid_at)} · ${method(p.method)}${p.note ? ` · ${p.note}` : ""}`)}</Text>
                  <Text style={[s.right, { width: "25%" }]}>{money(p.amount)}</Text>
                </View>
              ))
            )}
            {maintenancePayments.length > 0 && (
              <>
                <Text style={[s.bold, { marginTop: 10, marginBottom: 4 }]}>Maintenance renouvelée</Text>
                {maintenancePayments.map((p) => (
                  <View key={p.id} style={[s.row, s.line, { paddingVertical: 4 }]}>
                    <Text style={{ width: "75%" }}>{pdfText(`${formatDate(p.paid_at)} · maintenance de 6 mois · ${method(p.method)}`)}</Text>
                    <Text style={[s.right, { width: "25%" }]}>{money(p.amount)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 }} wrap={false}>
          <Text style={[s.bold, { marginBottom: 3 }]}>Conditions</Text>
          {kind === "devis" && (
            <Text style={s.muted}>{pdfText("Paiement : acompte de 50 % à la commande, solde à l'installation. Wave, Orange Money, espèces ou virement.")}</Text>
          )}
          <Text style={s.muted}>{pdfText("L'application est à vous : elle ne s'arrête jamais, même sans maintenance.")}</Text>
          <Text style={s.muted}>
            {pdfText(`Après les ${MAINTENANCE_INCLUDED_MONTHS} premiers mois, la maintenance (assistance, nouveautés, sauvegardes) est facultative : ${formatFCFA(sale.maintenance_price)} tous les 6 mois.`)}
          </Text>
          <Text style={s.muted}>{pdfText("Vos données vous appartiennent : vous pouvez les exporter dans Excel à tout moment.")}</Text>
        </View>

        {kind === "devis" && (
          <View style={[s.row, { gap: 14, marginTop: 18 }]} wrap={false}>
            <View style={{ flex: 1, height: 64, borderWidth: 1, borderStyle: "dashed", borderColor: "#c9cec9", borderRadius: 4, padding: 7 }}>
              <Text style={s.muted}>Pour Sama Stock</Text>
            </View>
            <View style={{ flex: 1, height: 64, borderWidth: 1, borderStyle: "dashed", borderColor: "#c9cec9", borderRadius: 4, padding: 7 }}>
              <Text style={s.muted}>Bon pour accord : date et signature du client</Text>
            </View>
          </View>
        )}

        <View fixed style={[s.row, { position: "absolute", bottom: 14, left: 40, right: 40, alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 }]}>
          <Image src={qr} style={{ width: 46, height: 46 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.small}>Scannez ce code pour vérifier ce document :</Text>
            <Text style={[s.small, s.muted]}>{verifyUrl}</Text>
            <Text style={[s.small, s.muted]}>{pdfText(`${LEGAL.editor} · NINEA ${LEGAL.ninea} · RCCM ${LEGAL.rccm} · ${LEGAL.city}`)}</Text>
          </View>
        </View>

        {cancelled && (
          <View fixed style={{ position: "absolute", top: 330, left: 0, right: 0, alignItems: "center" }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 64, lineHeight: 1.2, color: "#dc2626", opacity: 0.25, transform: "rotate(-18deg)" }}>
              {kind === "facture" ? "ANNULÉE" : "ANNULÉ"}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function renderLicencePdf(detail: Detail, kind: LicenceDoc, verifyUrl: string): Promise<Buffer> {
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 220, errorCorrectionLevel: "M" });
  return renderToBuffer(<LicencePdf detail={detail} kind={kind} verifyUrl={verifyUrl} qr={qr} />);
}

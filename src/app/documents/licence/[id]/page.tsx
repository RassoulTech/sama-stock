import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/licence/print-button";
import { Logo } from "@/components/brand/logo";
import { DownloadPdfButton, ShareDocumentButton } from "@/components/documents/share-document";
import { Button } from "@/components/ui/button";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { isLicensePack, LICENSE_PACKS } from "@/lib/domain/plans";
import { formatDate, formatFCFA, formatPhone } from "@/lib/format";
import { LEGAL } from "@/lib/legal";
import { NO_INDEX } from "@/lib/seo";
import { requireSuperAdmin } from "@/server/context";
import { balanceOf, getLicenseSale } from "@/server/queries/licences";
import { licenceShare } from "@/server/services/licence-documents";

export const metadata: Metadata = { title: "Document de licence", robots: NO_INDEX };

const KINDS = { devis: "Devis", facture: "Facture" } as const;

/** Devis ou facture d'une licence, au format A4, à imprimer ou à enregistrer en PDF. */
export default async function LicenseDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const detail = await getLicenseSale(id);
  if (!detail) notFound();
  const { sale, payments } = detail;
  const kind = query.type === "devis" ? "devis" : "facture";
  const pack = isLicensePack(sale.pack) ? LICENSE_PACKS[sale.pack] : null;
  const discount = sale.list_price - sale.agreed_price;
  const licencePayments = payments.filter((p) => p.kind === "licence");
  const maintenancePayments = payments.filter((p) => p.kind === "maintenance");
  const rest = balanceOf(sale);
  const share = licenceShare(sale, kind);

  return (
    <div className="min-h-dvh bg-muted/50 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 px-4 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/commerces/${sale.business_id}`}>
            <ArrowLeft /> Retour à la fiche
          </Link>
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/documents/licence/${sale.id}?type=${kind === "devis" ? "facture" : "devis"}`}>Voir {kind === "devis" ? "la facture" : "le devis"}</Link>
          </Button>
          <DownloadPdfButton pdfUrl={share.pdfUrl} label="Télécharger le PDF" />
          <ShareDocumentButton {...share} size="sm" label={`Envoyer ${kind === "facture" ? "la facture" : "le devis"} (PDF)`} className="bg-[#25D366] text-[#0b1310] hover:bg-[#1fb857]" />
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white px-6 py-8 text-[13px] leading-relaxed text-[#0b1310] shadow-sm sm:px-12 sm:py-12 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[#0b6e4f] pb-6">
          <div className="space-y-1">
            <Logo />
            <p className="pt-2 font-semibold">{LEGAL.editor}</p>
            <p className="text-[#58635e]">
              {LEGAL.city} · {LEGAL.phone} · {LEGAL.email}
            </p>
            <p className="text-[#58635e]">
              NINEA {LEGAL.ninea} · RCCM {LEGAL.rccm}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-[#0b6e4f]">{KINDS[kind].toUpperCase()}</p>
            <p className="font-semibold">N° {sale.number}</p>
            <p className="text-[#58635e]">du {formatDate(sale.created_at)}</p>
            {kind === "devis" && <p className="text-[#58635e]">valable 30 jours</p>}
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-[#f3f5f3] p-4">
            <p className="text-[11px] font-semibold tracking-wide text-[#58635e] uppercase">Client</p>
            <p className="mt-1 text-base font-semibold">{sale.business}</p>
            {sale.owner_name && <p>{sale.owner_name}</p>}
            {sale.city && <p>{sale.city}</p>}
            {sale.phone && <p>{formatPhone(sale.phone)}</p>}
            {sale.owner_email && <p>{sale.owner_email}</p>}
          </div>
          <div className="rounded-lg bg-[#f3f5f3] p-4">
            <p className="text-[11px] font-semibold tracking-wide text-[#58635e] uppercase">Objet</p>
            <p className="mt-1 font-semibold">Application Sama Stock à votre nom</p>
            <p>Gestion du stock, des ventes, des commandes et des crédits clients, installée et personnalisée pour votre commerce.</p>
          </div>
        </section>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="bg-[#0b6e4f] text-left text-white">
              <th className="px-3 py-2 font-semibold">Désignation</th>
              <th className="w-32 px-3 py-2 text-right font-semibold">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#e5e8e5]">
              <td className="px-3 py-2.5">
                <p className="font-semibold">Licence Sama Stock — forfait {pack?.label ?? sale.pack}</p>
                <p className="text-[#58635e]">Utilisation à vie{pack ? ` · ${pack.tagline.toLowerCase()}` : ""}</p>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatFCFA(sale.list_price)}</td>
            </tr>
            <tr className="border-b border-[#e5e8e5]">
              <td className="px-3 py-2.5">
                <p className="font-semibold">Installation et personnalisation</p>
                <p className="text-[#58635e]">Création de votre application, logo et couleur, import de vos produits, formation</p>
              </td>
              <td className="px-3 py-2.5 text-right text-[#58635e]">Inclus</td>
            </tr>
            <tr className="border-b border-[#e5e8e5]">
              <td className="px-3 py-2.5">
                <p className="font-semibold">Maintenance pendant 12 mois</p>
                <p className="text-[#58635e]">Assistance, nouveautés et sauvegardes</p>
              </td>
              <td className="px-3 py-2.5 text-right text-[#58635e]">Inclus</td>
            </tr>
            {discount > 0 && (
              <tr className="border-b border-[#e5e8e5]">
                <td className="px-3 py-2.5 font-semibold">Remise accordée</td>
                <td className="px-3 py-2.5 text-right tabular-nums">−{formatFCFA(discount)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-3 pt-3 text-right font-semibold">Montant à payer</td>
              <td className="px-3 pt-3 text-right text-base font-bold whitespace-nowrap tabular-nums">{formatFCFA(sale.agreed_price)}</td>
            </tr>
          </tfoot>
        </table>

        {kind === "facture" && (
          <section className="mt-6">
            <p className="mb-2 font-semibold">Paiements reçus</p>
            {licencePayments.length === 0 ? (
              <p className="text-[#58635e]">Aucun paiement reçu pour l&apos;instant.</p>
            ) : (
              <table className="w-full border-collapse">
                <tbody>
                  {licencePayments.map((p) => (
                    <tr key={p.id} className="border-b border-[#e5e8e5]">
                      <td className="px-3 py-2">
                        {formatDate(p.paid_at)} · {LICENSE_PAYMENT_METHODS[p.method as LicensePaymentMethod] ?? p.method}
                        {p.note && <span className="text-[#58635e]"> · {p.note}</span>}
                      </td>
                      <td className="w-32 px-3 py-2 text-right tabular-nums">{formatFCFA(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 flex justify-end">
              <div className="w-full max-w-xs space-y-1 rounded-lg bg-[#f3f5f3] p-3">
                <p className="flex justify-between">
                  <span>Total payé</span>
                  <span className="font-semibold tabular-nums">{formatFCFA(sale.paid_licence)}</span>
                </p>
                <p className="flex justify-between text-base">
                  <span className="font-semibold">Reste à payer</span>
                  <span className="font-bold tabular-nums" style={{ color: rest > 0 ? "#b45309" : "#15803d" }}>
                    {rest > 0 ? formatFCFA(rest) : "Soldé"}
                  </span>
                </p>
              </div>
            </div>
            {maintenancePayments.length > 0 && (
              <>
                <p className="mt-5 mb-2 font-semibold">Maintenance renouvelée</p>
                <table className="w-full border-collapse">
                  <tbody>
                    {maintenancePayments.map((p) => (
                      <tr key={p.id} className="border-b border-[#e5e8e5]">
                        <td className="px-3 py-2">
                          {formatDate(p.paid_at)} · maintenance d&apos;un an · {LICENSE_PAYMENT_METHODS[p.method as LicensePaymentMethod] ?? p.method}
                        </td>
                        <td className="w-32 px-3 py-2 text-right tabular-nums">{formatFCFA(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        )}

        <section className="mt-8 space-y-1.5 border-t border-[#e5e8e5] pt-4 text-[12px] text-[#58635e]">
          <p className="font-semibold text-[#0b1310]">Conditions</p>
          {kind === "devis" && <p>Paiement : acompte de 50 % à la commande, solde à l&apos;installation. Wave, Orange Money, espèces ou virement.</p>}
          <p>L&apos;application est à vous : elle ne s&apos;arrête jamais, même sans maintenance.</p>
          <p>
            Après les 12 premiers mois, la maintenance (assistance, nouveautés, sauvegardes) est facultative : {formatFCFA(sale.maintenance_price)} par an.
          </p>
          <p>Vos données vous appartiennent : vous pouvez les exporter dans Excel à tout moment.</p>
        </section>

        {kind === "devis" && (
          <section className="mt-8 grid grid-cols-2 gap-6 text-[12px]">
            <div className="h-24 rounded-lg border border-dashed border-[#d9ddd9] p-3">Pour Sama Stock</div>
            <div className="h-24 rounded-lg border border-dashed border-[#d9ddd9] p-3">Bon pour accord, date et signature du client</div>
          </section>
        )}

        <footer className="mt-10 text-center text-[11px] text-[#58635e]">
          {LEGAL.editor} · NINEA {LEGAL.ninea} · RCCM {LEGAL.rccm} · {LEGAL.city}
        </footer>
      </article>
    </div>
  );
}

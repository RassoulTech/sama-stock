import { BadgeCheck, Download, FileWarning, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { isLicenceDocKind, type SignedDocKind } from "@/lib/domain/document-token";
import { quoteDisplayStatus, QUOTE_STATUS_LABELS } from "@/lib/domain/documents";
import { isLicensePack, LICENSE_PACKS } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { LEGAL } from "@/lib/legal";
import { NO_INDEX } from "@/lib/seo";
import { getPublicDocument } from "@/server/queries/documents";
import { balanceOf, getLicenseSale } from "@/server/queries/licences";
import { readDocumentToken } from "@/server/services/documents";

export const metadata: Metadata = { title: "Vérifier un document", robots: NO_INDEX };

const TITLES = { facture: "Facture", devis: "Devis", recu: "Reçu" } as const;

/** Ce que la page affiche, pour un document de boutique comme pour une licence vendue par Sama Stock. */
interface Verified {
  title: string;
  number: string;
  issuer: string;
  date: Date;
  customer: string | null;
  total: number;
  state: string;
  cancelled: boolean;
  validUntil: Date | null;
  object: string | null;
}

async function load(kind: SignedDocKind, id: string): Promise<Verified | null> {
  if (isLicenceDocKind(kind)) {
    const detail = await getLicenseSale(id);
    if (!detail) return null;
    const { sale } = detail;
    const facture = kind === "licence_facture";
    const cancelled = sale.status !== "active";
    const rest = balanceOf(sale);
    return {
      title: facture ? "Facture" : "Devis",
      number: sale.number,
      issuer: `${LEGAL.editor} (Sama Stock)`,
      date: new Date(sale.created_at),
      customer: sale.business,
      total: sale.agreed_price,
      state: cancelled ? (facture ? "Annulée" : "Annulé") : facture ? (rest > 0 ? `Reste à payer : ${formatFCFA(rest)}` : "Payée") : "Valable 30 jours",
      cancelled,
      validUntil: null,
      object: `Licence ${isLicensePack(sale.pack) ? LICENSE_PACKS[sale.pack].label : sale.pack} (à vie)`,
    };
  }
  const doc = await getPublicDocument(kind, id);
  if (!doc) return null;
  const cancelled = doc.status === "annulee" || doc.status === "cancelled" || Boolean(doc.payment?.cancelled);
  const rest = doc.payment ? Math.max(0, doc.total - doc.payment.paid) : 0;
  return {
    title: TITLES[doc.kind],
    number: doc.number,
    issuer: doc.seller.name,
    date: doc.date,
    customer: doc.customer?.name ?? null,
    total: doc.total,
    state:
      doc.kind === "devis"
        ? QUOTE_STATUS_LABELS[quoteDisplayStatus(doc.status, doc.validUntil)]
        : cancelled
          ? doc.kind === "facture"
            ? "Annulée"
            : "Annulé"
          : rest > 0
            ? `Reste à payer : ${formatFCFA(rest)}`
            : "Payé",
    cancelled,
    validUntil: doc.kind === "devis" ? doc.validUntil : null,
    object: null,
  };
}

/** Page ouverte en scannant le QR code d'un document : confirme qu'il a bien été émis par la boutique. */
export default async function VerifierPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ref = readDocumentToken(token);
  const doc = ref ? await load(ref.kind, ref.id) : null;

  if (!ref || !doc) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-9" />
          </span>
          <h1 className="text-xl font-semibold">Document introuvable</h1>
          <p className="text-sm text-muted-foreground">
            Ce lien ne correspond à aucun document émis avec Sama Stock. Vérifiez qu&apos;il est complet, ou demandez le document à la
            boutique.
          </p>
        </div>
      </Shell>
    );
  }

  const { cancelled } = doc;

  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 text-center">
        {cancelled ? (
          <span className="grid size-16 place-items-center rounded-full bg-saffron/15 text-warning dark:text-saffron">
            <FileWarning className="size-9" />
          </span>
        ) : (
          <span className="grid size-16 place-items-center rounded-full bg-success/10 text-success">
            <BadgeCheck className="size-9" />
          </span>
        )}
        <h1 className="text-xl font-semibold">{cancelled ? `Ce document a été annulé` : "Document authentique"}</h1>
        <p className="text-sm text-muted-foreground">
          {doc.title} émis par <strong className="text-foreground">{doc.issuer}</strong>{doc.object ? "." : " avec Sama Stock."}
        </p>
      </div>

      <dl className="mt-6 divide-y rounded-xl border text-sm">
        <Row label="Document" value={`${doc.title} N° ${doc.number}`} />
        <Row label="Date" value={formatDate(doc.date)} />
        {doc.customer && <Row label="Client" value={doc.customer} />}
        {doc.object && <Row label="Objet" value={doc.object} />}
        <Row label="Montant" value={formatFCFA(doc.total)} strong />
        <Row label="État" value={doc.state} />
        {doc.validUntil && <Row label="Valable jusqu'au" value={formatDate(doc.validUntil)} />}
      </dl>

      <Button asChild size="lg" className="mt-6 w-full">
        <a href={`/verifier/${token}/pdf`}>
          <Download /> Voir le PDF
        </a>
      </Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Si les informations ne correspondent pas à votre document, il a peut-être été modifié : contactez la boutique.
      </p>
    </Shell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "num text-base font-semibold" : "text-right font-medium"}>{value}</dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted/40 px-4 py-10">
      <main className="mx-auto w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">{children}</main>
      <Link href="/" className="mx-auto mt-6 flex w-fit items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
        <LogoMark className="size-5" /> Documents vérifiés par Sama Stock
      </Link>
    </div>
  );
}

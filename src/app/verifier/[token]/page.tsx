import { BadgeCheck, Download, FileWarning, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { quoteDisplayStatus, QUOTE_STATUS_LABELS } from "@/lib/domain/documents";
import { formatDate, formatFCFA } from "@/lib/format";
import { NO_INDEX } from "@/lib/seo";
import { getPublicDocument } from "@/server/queries/documents";
import { readDocumentToken } from "@/server/services/documents";

export const metadata: Metadata = { title: "Vérifier un document", robots: NO_INDEX };

const TITLES = { facture: "Facture", devis: "Devis", recu: "Reçu" } as const;

/** Page ouverte en scannant le QR code d'un document : confirme qu'il a bien été émis par la boutique. */
export default async function VerifierPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ref = readDocumentToken(token);
  const doc = ref ? await getPublicDocument(ref.kind, ref.id) : null;

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

  const cancelled = doc.status === "annulee" || doc.status === "cancelled" || Boolean(doc.payment?.cancelled);
  const rest = doc.payment ? Math.max(0, doc.total - doc.payment.paid) : 0;
  const state =
    doc.kind === "devis"
      ? QUOTE_STATUS_LABELS[quoteDisplayStatus(doc.status, doc.validUntil)]
      : cancelled
        ? doc.kind === "facture"
          ? "Annulée"
          : "Annulé"
        : rest > 0
          ? `Reste à payer : ${formatFCFA(rest)}`
          : "Payé";

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
          {TITLES[doc.kind]} émis par <strong className="text-foreground">{doc.seller.name}</strong> avec Sama Stock.
        </p>
      </div>

      <dl className="mt-6 divide-y rounded-xl border text-sm">
        <Row label="Document" value={`${TITLES[doc.kind]} N° ${doc.number}`} />
        <Row label="Date" value={formatDate(doc.date)} />
        {doc.customer && <Row label="Client" value={doc.customer.name} />}
        <Row label="Montant" value={formatFCFA(doc.total)} strong />
        <Row label="État" value={state} />
        {doc.kind === "devis" && doc.validUntil && <Row label="Valable jusqu'au" value={formatDate(doc.validUntil)} />}
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

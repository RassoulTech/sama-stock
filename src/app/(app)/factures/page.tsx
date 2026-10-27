import { ChevronRight, FileText, Plus, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PaymentStatus } from "@/components/sales/sale-status";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { quoteDisplayStatus, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from "@/lib/domain/documents";
import { param, type SearchParams } from "@/lib/filters";
import { formatDate, formatFCFA } from "@/lib/format";
import { pageSlice, readPage } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listDocuments } from "@/server/queries/documents";

export const metadata: Metadata = { title: "Devis et factures" };

export default async function FacturesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireContext("sales.create");
  const params = await searchParams;
  const tab = param(params, "onglet") === "devis" ? "devis" : "facture";
  const page = readPage(params);
  const { rows, total } = await listDocuments(ctx, tab, pageSlice(page));
  const writable = !ctx.plan.readOnly;
  const missingLegal = ctx.can("settings.manage") && !ctx.business.ninea && !ctx.business.rccm;

  const newQuote = writable && (
    <Button asChild>
      <Link href="/factures/devis/nouveau">
        <Plus /> Nouveau devis
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Devis et factures"
        description="Des documents en PDF à votre nom, avec votre logo, à envoyer sur WhatsApp."
        actions={newQuote}
      />

      {missingLegal && (
        <Link
          href="/parametres#documents"
          className="mb-5 flex items-center gap-3 rounded-xl border border-saffron/40 bg-saffron/10 p-4 text-sm hover:bg-saffron/15"
        >
          <Settings className="size-5 shrink-0 text-warning dark:text-saffron" />
          <span className="flex-1">
            <strong>Ajoutez votre NINEA et votre RCCM</strong> dans les paramètres : ils seront imprimés sur vos factures.
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      <div className="mb-5 flex gap-2" role="tablist" aria-label="Type de document">
        {(
          [
            ["facture", "Factures", "/factures"],
            ["devis", "Devis", "/factures?onglet=devis"],
          ] as const
        ).map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            role="tab"
            aria-selected={tab === key}
            className={cn(
              "inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm font-medium text-muted-foreground hover:text-foreground",
              tab === key && "border-primary/30 bg-accent text-accent-foreground hover:text-accent-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        tab === "facture" ? (
          <EmptyState
            icon={FileText}
            title="Aucune facture pour l'instant"
            description="Ouvrez une vente ou une commande, puis touchez « Créer la facture ». Elle reprend tout, en un clic."
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="Aucun devis pour l'instant"
            description="Préparez un devis pour un client : il le reçoit en PDF, et vous le transformez en vente quand il est d'accord."
            action={newQuote}
          />
        )
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((d) => {
            const quoteStatus = tab === "devis" ? quoteDisplayStatus(d.status, d.validUntil) : null;
            return (
              <li key={d.id}>
                <Link
                  href={tab === "devis" ? `/factures/devis/${d.id}` : `/factures/${d.id}`}
                  className="flex h-full items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:ring-primary/30"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{d.number}</span>
                      {quoteStatus && <StatusPill tone={QUOTE_STATUS_TONES[quoteStatus]}>{QUOTE_STATUS_LABELS[quoteStatus]}</StatusPill>}
                      {d.status === "annulee" && <StatusPill tone="red">Annulée</StatusPill>}
                    </div>
                    <p className="truncate font-medium">{d.customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(d.createdAt)}
                      {d.saleNumber && ` · ${d.saleKind === "order" ? "commande" : "vente"} ${d.saleNumber}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="num font-semibold">{formatFCFA(d.total)}</span>
                    {tab === "facture" && d.status === "emise" && d.saleTotal !== null && (
                      <PaymentStatus total={d.total} amountPaid={Math.min(d.saleAmountPaid ?? 0, d.total)} />
                    )}
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination path="/factures" params={params} page={page} total={total} />
    </>
  );
}

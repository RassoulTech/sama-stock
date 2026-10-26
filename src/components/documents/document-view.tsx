import { LogoMark } from "@/components/brand/logo";
import { vatBreakdown } from "@/lib/domain/documents";
import { formatDate, formatFCFA, formatPhone, formatQty } from "@/lib/format";
import type { DocumentDetail } from "@/server/queries/documents";

/** Aperçu à l'écran d'un devis ou d'une facture (le PDF reprend la même chose). */
export function DocumentView({ doc, logo, paid }: { doc: DocumentDetail; logo: string | null; paid: number | null }) {
  const vat = doc.vatRate > 0 ? vatBreakdown(doc.items, doc.discount, doc.deliveryFee, doc.vatRate) : null;
  const rest = paid === null ? 0 : Math.max(0, doc.total - paid);
  const seller = doc.seller;

  return (
    <article className="relative w-full rounded-2xl border bg-card p-5 shadow-[0_8px_30px_-12px_rgba(14,26,22,0.25)] sm:p-7">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
            <img src={logo} alt="" className="size-12 rounded-xl object-cover" />
          ) : (
            <LogoMark className="size-11" />
          )}
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{seller.name}</p>
            <p className="text-muted-foreground">{[seller.address, seller.city].filter(Boolean).join(", ")}</p>
            {(seller.ninea || seller.rccm) && (
              <p className="text-xs text-muted-foreground">{[seller.ninea && `NINEA ${seller.ninea}`, seller.rccm && `RCCM ${seller.rccm}`].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-lg font-bold tracking-wide text-primary uppercase">{doc.type === "devis" ? "Devis" : "Facture"}</p>
          <p className="font-semibold">N° {doc.number}</p>
          <p className="text-muted-foreground">du {formatDate(doc.createdAt)}</p>
          {doc.validUntil && <p className="text-muted-foreground">valable jusqu&apos;au {formatDate(doc.validUntil)}</p>}
        </div>
      </header>

      <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{doc.type === "facture" ? "Facturé à" : "Client"}</p>
        <p className="mt-0.5 font-semibold">{doc.customer.name}</p>
        {doc.customer.phone && <p>{formatPhone(doc.customer.phone)}</p>}
        {doc.customer.address && <p>{doc.customer.address}</p>}
        {doc.customer.ninea && <p>NINEA {doc.customer.ninea}</p>}
      </div>

      <ul className="mt-4 divide-y text-sm">
        {doc.items.map((i, idx) => (
          <li key={i.id} className="flex justify-between gap-3 py-2.5">
            <span>
              <span className="font-medium">{i.name}</span>
              <span className="num block text-xs text-muted-foreground">
                {formatQty(i.quantity, i.unit)} × {formatFCFA(vat ? Math.round(i.unitPrice / (1 + doc.vatRate / 100)) : i.unitPrice)}
                {vat && " HT"}
              </span>
            </span>
            <span className="num font-semibold whitespace-nowrap">{formatFCFA(vat ? vat.linesHT[idx]! : i.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-2 space-y-1.5 border-t pt-3 text-sm">
        {vat ? (
          <>
            {doc.discount > 0 && <Line label="Remise HT" value={`−${formatFCFA(vat.discountHT)}`} />}
            {doc.deliveryFee > 0 && <Line label="Livraison HT" value={formatFCFA(vat.deliveryHT)} />}
            <Line label="Total HT" value={formatFCFA(vat.totalHT)} />
            <Line label={`TVA ${doc.vatRate} %`} value={formatFCFA(vat.vat)} />
          </>
        ) : (
          <>
            {(doc.discount > 0 || doc.deliveryFee > 0) && <Line label="Sous-total" value={formatFCFA(doc.subtotal)} />}
            {doc.discount > 0 && <Line label="Remise" value={`−${formatFCFA(doc.discount)}`} />}
            {doc.deliveryFee > 0 && <Line label="Livraison" value={formatFCFA(doc.deliveryFee)} />}
          </>
        )}
        <div className="flex items-baseline justify-between pt-1">
          <dt className="font-semibold">{vat ? "Total TTC" : "Total"}</dt>
          <dd className="num text-2xl font-semibold">{formatFCFA(doc.total)}</dd>
        </div>
        {paid !== null && (
          <>
            <Line label="Payé" value={formatFCFA(paid)} />
            <div className={rest > 0 ? "flex justify-between font-semibold text-destructive" : "flex justify-between font-semibold text-success"}>
              <dt>Reste à payer</dt>
              <dd className="num">{rest > 0 ? formatFCFA(rest) : "Soldé"}</dd>
            </div>
          </>
        )}
      </dl>
      {!vat && <p className="mt-3 text-xs text-muted-foreground">Non assujetti à la TVA.</p>}
      {doc.note && <p className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">{doc.note}</p>}
      {doc.footer && <p className="mt-3 text-xs text-muted-foreground">{doc.footer}</p>}

      {doc.status === "annulee" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="-rotate-12 rounded-xl border-4 border-destructive px-4 py-1 text-2xl font-black tracking-widest text-destructive uppercase opacity-80">
            Annulée
          </span>
        </div>
      )}
    </article>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

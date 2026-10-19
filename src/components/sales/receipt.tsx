import { LogoMark } from "@/components/brand/logo";
import { formatDateTime, formatFCFA, formatPhone, formatQty } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/sales";
import type { Business } from "@/server/context";
import type { SaleDetail } from "@/server/queries/sales";

export function Receipt({ sale, business }: { sale: SaleDetail; business: Business }) {
  const rest = sale.total - sale.amountPaid;
  const method = sale.paymentMethod ? (PAYMENT_METHODS[sale.paymentMethod as PaymentMethod] ?? sale.paymentMethod) : null;

  return (
    <article className="relative mx-auto w-full max-w-md rounded-2xl bg-card p-6 shadow-[0_8px_30px_-12px_rgba(14,26,22,0.25)] border print:max-w-none print:shadow-none print:ring-0">
      <header className="flex flex-col items-center gap-2 border-b border-dashed pb-5 text-center">
        {business.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
          <img src={business.logo} alt="" className="size-14 rounded-xl object-cover" />
        ) : (
          <LogoMark className="size-12" />
        )}
        <h2 className="text-lg font-semibold">{business.name}</h2>
        <p className="text-xs text-muted-foreground">
          {[business.address, business.city].filter(Boolean).join(", ")}
          {business.phone && <> · {formatPhone(business.phone)}</>}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-y-1 border-b border-dashed py-4 text-sm">
        <span className="text-muted-foreground">Reçu</span>
        <span className="text-right font-semibold">{sale.number}</span>
        <span className="text-muted-foreground">Date</span>
        <span className="text-right">{formatDateTime(sale.createdAt)}</span>
        {sale.sellerName && (
          <>
            <span className="text-muted-foreground">Vendeur</span>
            <span className="text-right">{sale.sellerName}</span>
          </>
        )}
        {sale.customer && (
          <>
            <span className="text-muted-foreground">Client</span>
            <span className="text-right">{sale.customer.name}</span>
          </>
        )}
      </div>

      <ul className="space-y-3 border-b border-dashed py-4 text-sm">
        {sale.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>
              <span className="font-medium">{i.name}</span>
              <span className="num block text-xs text-muted-foreground">
                {formatQty(i.quantity, i.unit)} × {formatFCFA(i.unitPrice)}
              </span>
            </span>
            <span className="num font-semibold whitespace-nowrap">{formatFCFA(i.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-1.5 pt-4 text-sm">
        {(sale.discount > 0 || sale.deliveryFee > 0) && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Sous-total</dt>
            <dd className="num">{formatFCFA(sale.subtotal)}</dd>
          </div>
        )}
        {sale.discount > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Remise</dt>
            <dd className="num">−{formatFCFA(sale.discount)}</dd>
          </div>
        )}
        {sale.deliveryFee > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Livraison</dt>
            <dd className="num">{formatFCFA(sale.deliveryFee)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-1">
          <dt className="font-semibold">Total</dt>
          <dd className="num text-2xl font-semibold">{formatFCFA(sale.total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Payé{method && sale.amountPaid > 0 ? ` (${method})` : ""}</dt>
          <dd className="num font-semibold">{formatFCFA(sale.amountPaid)}</dd>
        </div>
        {rest > 0 && (
          <div className="flex justify-between font-semibold text-destructive">
            <dt>Reste à payer</dt>
            <dd className="num">{formatFCFA(rest)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-6 text-center text-xs text-muted-foreground">Merci pour votre confiance !</p>
      {sale.status === "cancelled" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="-rotate-12 rounded-xl border-4 border-destructive px-4 py-1 text-2xl font-black tracking-widest text-destructive uppercase opacity-80">
            Annulée
          </span>
        </div>
      )}
    </article>
  );
}

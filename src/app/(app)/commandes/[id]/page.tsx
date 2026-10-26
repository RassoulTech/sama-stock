import { Check, FileText, MapPin, MessageCircle, Phone, StickyNote, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateInvoiceDialog } from "@/components/documents/document-actions";
import { OrderPaymentDialog, OrderStatusButtons } from "@/components/orders/order-actions";
import { PaymentStatus, SaleStatus } from "@/components/sales/sale-status";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatFCFA, formatPhone, formatQty } from "@/lib/format";
import { isOrderStatus, nextStatuses, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain/orders";
import { CHANNELS, PAYMENT_METHODS, type Channel, type PaymentMethod } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";
import { orderMessage, waLink } from "@/lib/whatsapp";
import { requireContext } from "@/server/context";
import { invoiceOfSale } from "@/server/queries/documents";
import { getSale } from "@/server/queries/sales";

export const metadata: Metadata = { title: "Commande" };

const STEPS: OrderStatus[] = ["new", "preparing", "shipping", "delivered"];

export default async function CommandePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext("orders.manage");
  const order = await getSale(ctx, id);
  if (!order || order.kind !== "order" || !isOrderStatus(order.status)) notFound();
  const invoice = await invoiceOfSale(ctx.business.id, order.id);

  const status = order.status as OrderStatus;
  const closed = status === "cancelled" || status === "returned";
  const stepIndex = STEPS.indexOf(status);
  const rest = order.total - order.amountPaid;
  const writable = !ctx.plan.readOnly;

  const message = order.customer
    ? orderMessage({
        businessName: ctx.business.name,
        customerName: order.customer.name,
        number: order.number,
        statusLabel: ORDER_STATUS_LABELS[status],
        items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, lineTotal: i.lineTotal })),
        deliveryFee: order.deliveryFee,
        total: order.total,
        amountPaid: order.amountPaid,
        deliveryAddress: order.deliveryAddress,
      })
    : null;

  return (
    <>
      <PageHeader
        backHref="/commandes"
        title={
          <span className="flex flex-wrap items-center gap-3">
            Commande {order.number} <SaleStatus kind="order" status={status} />
          </span>
        }
        description={`${CHANNELS[order.channel as Channel] ?? order.channel} · reçue le ${formatDateTime(order.createdAt)}`}
      />

      {!closed && (
        <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Avancement de la commande">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={s} className="flex flex-col items-center gap-2 text-center">
                <span className="flex w-full items-center">
                  <span className={cn("h-1 flex-1 rounded-full", i === 0 ? "bg-transparent" : i <= stepIndex ? "bg-primary" : "bg-border")} />
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold",
                      done && "border-primary bg-primary text-primary-foreground",
                      current && "border-primary bg-accent text-primary",
                      !done && !current && "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span className={cn("h-1 flex-1 rounded-full", i === STEPS.length - 1 ? "bg-transparent" : i < stepIndex ? "bg-primary" : "bg-border")} />
                </span>
                <span className={cn("text-xs font-medium", current ? "text-foreground" : "text-muted-foreground")}>
                  {ORDER_STATUS_LABELS[s]}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Produits</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {order.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span>
                      {i.productId ? (
                        <Link href={`/produits/${i.productId}`} className="font-semibold hover:text-primary">
                          {i.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{i.name}</span>
                      )}
                      <span className="num block text-xs text-muted-foreground">
                        {formatQty(i.quantity, i.unit)} × {formatFCFA(i.unitPrice)}
                      </span>
                    </span>
                    <span className="num font-semibold">{formatFCFA(i.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Produits</dt>
                  <dd className="num">{formatFCFA(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Livraison</dt>
                  <dd className="num">{formatFCFA(order.deliveryFee)}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="font-semibold">Total</dt>
                  <dd className="num text-xl font-semibold">{formatFCFA(order.total)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">
                    Payé
                    {order.paymentMethod && order.amountPaid > 0 && (
                      <> ({PAYMENT_METHODS[order.paymentMethod as PaymentMethod] ?? order.paymentMethod})</>
                    )}
                  </dt>
                  <dd className="flex items-center gap-2">
                    <span className="num font-semibold">{formatFCFA(order.amountPaid)}</span>
                    <PaymentStatus total={order.total} amountPaid={order.amountPaid} />
                  </dd>
                </div>
              </dl>
              {order.profit !== null && status === "delivered" && (
                <p className="mt-4 flex items-center justify-between rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="size-4" /> Bénéfice
                  </span>
                  <span className="num font-semibold">{formatFCFA(order.profit)}</span>
                </p>
              )}
            </CardContent>
          </Card>
          {order.note && (
            <Card size="sm">
              <CardContent className="flex gap-3 text-sm">
                <StickyNote className="size-4 shrink-0 text-muted-foreground" /> {order.note}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {writable && !closed && status !== "delivered" && (
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold">Étape suivante</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderStatusButtons id={order.id} next={nextStatuses(status)} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Client et livraison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {order.customer ? (
                <Link href={`/clients/${order.customer.id}`} className="block font-semibold hover:text-primary">
                  {order.customer.name}
                </Link>
              ) : (
                <p className="text-muted-foreground">Client supprimé</p>
              )}
              {order.customer?.phone && (
                <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="size-4 text-muted-foreground" /> {formatPhone(order.customer.phone)}
                </a>
              )}
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {order.deliveryAddress ?? <span className="text-muted-foreground">Pas d&apos;adresse</span>}
              </p>
              {message && (
                <Button asChild className="w-full bg-[#25D366] text-white hover:bg-[#1fb857]">
                  <a href={waLink(order.customer?.phone, message)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> Envoyer le récapitulatif
                  </a>
                </Button>
              )}
              {writable && !closed && rest > 0 && <OrderPaymentDialog id={order.id} rest={rest} />}
            </CardContent>
          </Card>
          {invoice ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/factures/${invoice.id}`}>
                <FileText /> Voir la facture {invoice.number}
              </Link>
            </Button>
          ) : (
            writable &&
            !closed &&
            ctx.can("sales.create") && <CreateInvoiceDialog saleId={order.id} customer={order.customer} />
          )}
          {closed && (
            <StatusPill tone="gray" className="w-full justify-center py-2 text-sm">
              Commande {ORDER_STATUS_LABELS[status].toLowerCase()} le {order.cancelledAt ? formatDateTime(order.cancelledAt) : "—"}
            </StatusPill>
          )}
        </div>
      </div>
    </>
  );
}

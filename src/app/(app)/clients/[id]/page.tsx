import { HandCoins, MapPin, MessageCircle, Pencil, Phone, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { PaymentDialog } from "@/components/customers/payment-dialog";
import { PaymentStatus, SaleStatus } from "@/components/sales/sale-status";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatFCFA, formatPhone } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/sales";
import { debtReminderMessage, waLink } from "@/lib/whatsapp";
import { requireContext } from "@/server/context";
import { getCustomer } from "@/server/queries/customers";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext("customers.manage");
  const data = await getCustomer(ctx, id);
  if (!data) notFound();
  const { customer, history, payments, debt } = data;
  const writable = !ctx.plan.readOnly;

  const timeline = [
    ...history.map((h) => ({ kind: "sale" as const, date: h.createdAt, h })),
    ...payments.map((p) => ({ kind: "payment" as const, date: p.createdAt, p })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <>
      <PageHeader
        backHref="/clients"
        title={customer.name}
        description={customer.note ?? undefined}
        actions={
          <>
            {customer.phone && (
              <Button asChild variant="outline">
                <a href={`tel:${customer.phone}`}>
                  <Phone /> Appeler
                </a>
              </Button>
            )}
            {writable && (
              <CustomerDialog
                customer={customer}
                trigger={
                  <Button variant="outline">
                    <Pencil /> Modifier
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <Card className={debt > 0 ? "ring-destructive/25" : undefined}>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{debt > 0 ? "Reste à payer" : "Situation"}</p>
                <p className={`num mt-1 text-3xl font-semibold ${debt > 0 ? "text-destructive" : "text-success"}`}>
                  {debt > 0 ? formatFCFA(debt) : "À jour"}
                </p>
              </div>
              {debt > 0 && (
                <div className="flex flex-col gap-2">
                  {customer.phone ? (
                    <Button asChild variant="saffron">
                      <a
                        href={waLink(customer.phone, debtReminderMessage(customer.name, debt, ctx.business.name))}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle /> Rappeler par WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Ajoutez un téléphone pour envoyer un rappel WhatsApp.</p>
                  )}
                  {writable && <PaymentDialog customerId={customer.id} customerName={customer.name} debt={debt} />}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                {customer.phone ? formatPhone(customer.phone) : <span className="text-muted-foreground">Pas de téléphone</span>}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                {customer.address ?? <span className="text-muted-foreground">Pas d&apos;adresse</span>}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-semibold">Historique</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <EmptyState icon={Receipt} title="Aucun achat pour l'instant" />
            ) : (
              <ul className="divide-y">
                {timeline.map((t) =>
                  t.kind === "sale" ? (
                    <li key={t.h.id}>
                      <Link
                        href={t.h.kind === "order" ? `/commandes/${t.h.id}` : `/ventes/${t.h.id}`}
                        className="flex items-center justify-between gap-3 py-3 hover:text-primary"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">
                            {t.h.kind === "order" ? "Commande" : "Vente"} {t.h.number}
                            <SaleStatus kind={t.h.kind} status={t.h.status} />
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(t.h.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="num font-semibold">{formatFCFA(t.h.total)}</p>
                          <PaymentStatus total={t.h.total} amountPaid={t.h.amountPaid} />
                        </div>
                      </Link>
                    </li>
                  ) : (
                    <li key={t.p.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-success/10 text-success">
                          <HandCoins className="size-4" />
                        </span>
                        <div>
                          <p className="font-semibold">Remboursement</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(t.p.createdAt)} · {PAYMENT_METHODS[t.p.method as PaymentMethod] ?? t.p.method}
                            {t.p.userName && <> · {t.p.userName}</>}
                          </p>
                        </div>
                      </div>
                      <p className="num font-semibold text-success">+{formatFCFA(t.p.amount)}</p>
                    </li>
                  ),
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

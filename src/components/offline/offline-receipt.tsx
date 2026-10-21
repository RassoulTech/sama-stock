"use client";

import { CheckCircle2, CloudOff, MessageCircle, Plus } from "lucide-react";
import { PrintButton } from "@/components/sales/print-button";
import { Receipt, type ReceiptBusiness, type ReceiptData } from "@/components/sales/receipt";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHODS } from "@/lib/domain/sales";
import { lineTotal, offlineLabel, saleTotals } from "@/lib/offline/sale";
import type { OutboxSale } from "@/lib/offline/types";
import { cn } from "@/lib/utils";
import { receiptMessage, waLink } from "@/lib/whatsapp";
import { useOfflineMode } from "./offline-provider";

/** Reçu d'une vente gardée dans le téléphone (numéro provisoire tant qu'elle n'est pas envoyée). */
export function outboxReceipt(sale: OutboxSale, sellerName: string | null): ReceiptData {
  const { subtotal, total, amountPaid } = saleTotals(sale.items, sale.discount, sale.paymentMethod, sale.amountReceived);
  return {
    number: sale.serverNumber ?? offlineLabel(sale.localNumber),
    createdAt: new Date(sale.createdAt),
    status: "completed",
    sellerName,
    customer: sale.customerName ? { name: sale.customerName } : null,
    items: sale.items.map((i) => ({
      id: i.productId,
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: lineTotal(i.quantity, i.unitPrice),
    })),
    subtotal,
    discount: sale.discount,
    deliveryFee: 0,
    total,
    amountPaid,
    paymentMethod: sale.paymentMethod,
  };
}

export function OfflineReceipt({
  sale: initial,
  business,
  sellerName,
  onNewSale,
}: {
  sale: OutboxSale;
  business: ReceiptBusiness;
  sellerName: string | null;
  onNewSale: () => void;
}) {
  const { outbox } = useOfflineMode();
  // Version à jour : le vrai numéro apparaît dès que la vente est envoyée
  const sale = outbox.find((s) => s.clientRef === initial.clientRef) ?? initial;
  const data = outboxReceipt(sale, sellerName);
  const sent = sale.status === "sent";
  const message = receiptMessage({
    businessName: business.name,
    number: data.number,
    date: data.createdAt,
    items: data.items,
    discount: data.discount,
    deliveryFee: 0,
    total: data.total,
    amountPaid: data.amountPaid,
    paymentLabel: PAYMENT_METHODS[sale.paymentMethod],
  });

  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-3 text-center print:hidden">
        <span
          className={cn(
            "grid size-16 place-items-center rounded-full",
            sent ? "bg-success/10 text-success" : "bg-saffron/15 text-warning dark:text-saffron",
          )}
        >
          {sent ? <CheckCircle2 className="size-9" /> : <CloudOff className="size-9" />}
        </span>
        <h1 className="text-2xl font-semibold">{sent ? "Vente envoyée !" : "Vente enregistrée dans le téléphone"}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {sent
            ? `Elle porte maintenant le numéro ${sale.serverNumber}.`
            : "Elle sera envoyée automatiquement au retour d'internet. Le stock affiché tient déjà compte de cette vente."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <Receipt sale={data} business={business} />
        <div className="space-y-3 print:hidden">
          <Button asChild size="lg" className="w-full bg-[#25D366] text-white hover:bg-[#1fb857]">
            <a href={waLink(sale.customerPhone, message)} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Envoyer sur WhatsApp
            </a>
          </Button>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <PrintButton />
            <Button variant="saffron" onClick={onNewSale}>
              <Plus /> Nouvelle vente
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

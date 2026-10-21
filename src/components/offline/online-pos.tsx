"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomerOption } from "@/components/customers/customer-dialog";
import { PosScreen, type PosProduct } from "@/components/pos/pos-screen";
import type { ReceiptBusiness } from "@/components/sales/receipt";
import { localAvailability } from "@/lib/offline/stock";
import type { OutboxSale, SaleDraft } from "@/lib/offline/types";
import { createSale } from "@/server/actions/sales";
import { OfflineReceipt } from "./offline-receipt";
import { useOfflineMode } from "./offline-provider";

/**
 * Caisse de la page /vendre : la vente part au serveur. Si internet coupe au moment de valider, elle est gardée
 * dans le téléphone et un reçu provisoire s'affiche.
 */
export function OnlinePos({
  products,
  categories,
  customers,
  business,
  sellerName,
}: {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  customers: CustomerOption[];
  business: ReceiptBusiness;
  sellerName: string;
}) {
  const router = useRouter();
  const offline = useOfflineMode();
  const [receipt, setReceipt] = useState<OutboxSale | null>(null);

  const id = offline.identity;
  const shown = id ? localAvailability(products, offline.outbox, id.businessId, id.locationId) : products;

  async function submit(draft: SaleDraft): Promise<string | null> {
    let res: Awaited<ReturnType<typeof createSale>>;
    try {
      res = await createSale({
        clientRef: draft.clientRef,
        items: draft.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        discount: draft.discount,
        customerId: draft.customer?.id ?? null,
        paymentMethod: draft.paymentMethod,
        amountReceived: draft.amountReceived,
      });
    } catch {
      // Pas de réponse du serveur : la vente est gardée dans le téléphone (même identifiant, donc jamais en double)
      try {
        setReceipt(await offline.enqueueSale(draft));
        return null;
      } catch {
        return "Pas d'internet, et la caisse hors ligne n'est pas prête. Réessayez dans un instant.";
      }
    }
    if (!res.ok) return res.error;
    void offline.refreshSnapshot(true);
    router.push(`/ventes/${res.data.id}?nouvelle=1`);
    router.refresh();
    return null;
  }

  if (receipt) {
    return <OfflineReceipt sale={receipt} business={business} sellerName={sellerName} onNewSale={() => setReceipt(null)} />;
  }
  return <PosScreen products={shown} categories={categories} customers={customers} submit={submit} allowCustomerCreate={offline.online} />;
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { CustomerOption } from "@/components/customers/customer-dialog";
import { PosScreen, type PosInitial, type PosProduct } from "@/components/pos/pos-screen";
import type { ReceiptBusiness } from "@/components/sales/receipt";
import { localAvailability } from "@/lib/offline/stock";
import type { OutboxSale, SaleDraft } from "@/lib/offline/types";
import { correctSale, createSale } from "@/server/actions/sales";
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
  correction,
  banner,
}: {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  customers: CustomerOption[];
  business: ReceiptBusiness;
  sellerName: string;
  /** Correction d'une vente : elle part au serveur (internet obligatoire), jamais dans le téléphone. */
  correction?: { id: string; initial: PosInitial };
  banner?: React.ReactNode;
}) {
  const router = useRouter();
  const offline = useOfflineMode();
  const [receipt, setReceipt] = useState<OutboxSale | null>(null);

  const id = offline.identity;
  const shown = id ? localAvailability(products, offline.outbox, id.businessId, id.locationId) : products;

  async function submitCorrection(id: string, draft: SaleDraft): Promise<string | null> {
    let res: Awaited<ReturnType<typeof correctSale>>;
    try {
      res = await correctSale(id, {
        items: draft.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.negotiated ? i.unitPrice : undefined })),
        discount: draft.discount,
        customerId: draft.customer?.id ?? null,
        paymentMethod: draft.paymentMethod,
        amountReceived: draft.amountReceived,
      });
    } catch {
      return "Il faut internet pour corriger une vente. Réessayez quand la connexion revient.";
    }
    if (!res.ok) return res.error;
    toast.success("Vente corrigée : l'ancienne est annulée");
    void offline.refreshSnapshot(true);
    router.push(`/ventes/${res.data.id}`);
    router.refresh();
    return null;
  }

  async function submit(draft: SaleDraft): Promise<string | null> {
    if (correction) return submitCorrection(correction.id, draft);
    let res: Awaited<ReturnType<typeof createSale>>;
    try {
      res = await createSale({
        clientRef: draft.clientRef,
        // Le prix ne part que s'il a été négocié : sinon le serveur prend le prix du produit (toujours à jour)
        items: draft.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.negotiated ? i.unitPrice : undefined })),
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
  return (
    <PosScreen
      // En correction, le stock affiché est celui du serveur (ventes en attente comprises), plus l'ancienne vente
      products={correction ? products : shown}
      categories={categories}
      customers={customers}
      submit={submit}
      allowCustomerCreate={offline.online}
      initial={correction?.initial}
      banner={banner}
    />
  );
}

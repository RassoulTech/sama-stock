import type { SaleMethod } from "@/lib/domain/sales";

/** Produit tel que gardé dans le téléphone (jamais de prix d'achat). */
export interface OfflineProduct {
  id: string;
  name: string;
  unit: string;
  salePrice: number;
  /** Disponible au moment de la copie : stock moins les commandes réservées. */
  available: number;
  alertThreshold: number;
  categoryId: string | null;
}

/** Copie locale de la caisse, téléchargée à chaque ouverture de l'application avec internet. */
export interface OfflineSnapshot {
  version: 1;
  savedAt: string;
  user: { id: string; name: string };
  business: {
    id: string;
    name: string;
    logo: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    brandColor: string | null;
    licensed: boolean;
  };
  location: { id: string; name: string };
  can: { sell: boolean; viewStock: boolean };
  /** sellUntil : fin de l'essai gratuit ; null pour une licence, qui n'expire jamais. */
  plan: { readOnly: boolean; sellUntil: string | null; label: string };
  modulePos: boolean;
  products: OfflineProduct[];
  categories: { id: string; name: string }[];
  customers: { id: string; name: string; phone: string | null }[];
}

export interface OutboxItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  /** Prix négocié avec le client à la caisse (et non un prix qui aurait changé depuis). */
  negotiated?: boolean;
}

/** Vente préparée par la caisse, avant d'être envoyée au serveur ou gardée dans le téléphone. */
export interface SaleDraft {
  clientRef: string;
  items: OutboxItem[];
  discount: number;
  paymentMethod: SaleMethod;
  amountReceived: number;
  customer: { id: string; name: string; phone: string | null } | null;
}

export type OutboxStatus = "pending" | "refused" | "sent";

/** Vente gardée dans le téléphone jusqu'à ce que le serveur l'accepte. */
export interface OutboxSale {
  clientRef: string;
  userId: string;
  businessId: string;
  locationId: string;
  /** Heure du téléphone au moment de la vente (ISO). */
  createdAt: string;
  /** Numéro provisoire du reçu : « Hors ligne n° 3 ». */
  localNumber: number;
  items: OutboxItem[];
  discount: number;
  paymentMethod: SaleMethod;
  amountReceived: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: OutboxStatus;
  error: string | null;
  attempts: number;
  serverId: string | null;
  serverNumber: string | null;
  sentAt: string | null;
}

export type SyncResult =
  | { clientRef: string; status: "ok"; id: string; number: string }
  | { clientRef: string; status: "refused"; error: string }
  | { clientRef: string; status: "retry"; error: string };

export interface OfflineIdentity {
  userId: string;
  businessId: string;
  locationId: string;
}

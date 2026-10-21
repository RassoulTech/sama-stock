import { z } from "zod";
import { SALE_METHODS } from "@/lib/domain/sales";
import type { OutboxSale } from "./types";

/** Format d'envoi des ventes hors ligne. Versionné : une vente gardée par une ancienne version reste envoyable. */
export const OFFLINE_SYNC_VERSION = 1;
export const MAX_SYNC_BATCH = 50;

export const offlineSaleInputSchema = z.object({
  clientRef: z.uuid(),
  businessId: z.string().min(1).max(64),
  locationId: z.string().min(1).max(64),
  createdAt: z.iso.datetime({ offset: true }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        quantity: z.number().positive().max(10_000_000),
        unitPrice: z.number().int().min(0).max(1_000_000_000),
      }),
    )
    .min(1)
    .max(200),
  discount: z.number().int().min(0).max(1_000_000_000),
  paymentMethod: z.enum(SALE_METHODS),
  amountReceived: z.number().int().min(0).max(1_000_000_000),
  customerId: z.string().min(1).max(64).nullable(),
});

export const syncRequestSchema = z.object({
  version: z.literal(OFFLINE_SYNC_VERSION),
  sales: z.array(offlineSaleInputSchema).min(1).max(MAX_SYNC_BATCH),
});

export type OfflineSaleInput = z.infer<typeof offlineSaleInputSchema>;

/** Ce qui part au serveur : l'utilisateur vient de la session, jamais du téléphone. */
export function toSyncInput(s: OutboxSale): OfflineSaleInput {
  return {
    clientRef: s.clientRef,
    businessId: s.businessId,
    locationId: s.locationId,
    createdAt: s.createdAt,
    items: s.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
    discount: s.discount,
    paymentMethod: s.paymentMethod,
    amountReceived: s.amountReceived,
    customerId: s.customerId,
  };
}

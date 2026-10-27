import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import type { Tx } from "@/db";
import { notifications, products, stockLevels } from "@/db/schema";
import { stockCrossing, stockMessage, type NotifyMessage } from "@/lib/domain/notifications";
import { roundQty } from "@/lib/domain/stock";
import type { BusinessContext } from "../context";
import { deliverPush } from "../push";
import { reservedQuantities } from "./stock";

/**
 * Enregistre une notification du commerce (dans la transaction de l'action) ; elle part sur les téléphones abonnés
 * après la réponse. Une transaction annulée n'envoie donc rien : la notification n'existe pas.
 */
export async function notify(tx: Tx, ctx: BusinessContext, message: NotifyMessage): Promise<void> {
  const [row] = await tx
    .insert(notifications)
    .values({ businessId: ctx.business.id, kind: message.kind, title: message.title, body: message.body, href: message.href, actorId: ctx.user.id })
    .returning({ id: notifications.id });
  after(() => deliverPush(row!.id));
}

/** Disponible (physique moins commandes réservées) et seuil d'alerte de produits, dans une boutique. */
async function stockSnapshot(tx: Tx, businessId: string, locationId: string, ids: string[]) {
  const rows = await tx
    .select({ id: products.id, name: products.name, unit: products.unit, threshold: products.alertThreshold, quantity: stockLevels.quantity })
    .from(products)
    .leftJoin(stockLevels, and(eq(stockLevels.productId, products.id), eq(stockLevels.locationId, locationId)))
    .where(and(eq(products.businessId, businessId), inArray(products.id, ids)));
  const reserved = await reservedQuantities(tx, businessId, locationId, ids);
  return new Map(
    rows.map((r) => [r.id, { name: r.name, unit: r.unit, threshold: Number(r.threshold), available: roundQty(Number(r.quantity ?? 0) - (reserved.get(r.id) ?? 0)) }]),
  );
}

/**
 * Note le stock disponible avant une sortie (vente, commande, perte…). La fonction rendue, appelée après la sortie,
 * prévient pour chaque produit passé en « stock bas » ou en rupture.
 */
export async function watchStock(tx: Tx, ctx: BusinessContext, productIds: (string | null | undefined)[], locationId = ctx.location.id) {
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))];
  const before = ids.length > 0 ? await stockSnapshot(tx, ctx.business.id, locationId, ids) : new Map();
  return async () => {
    if (ids.length === 0) return;
    const now = await stockSnapshot(tx, ctx.business.id, locationId, ids);
    const locationName = ctx.locations.length > 1 ? (ctx.locations.find((l) => l.id === locationId)?.name ?? null) : null;
    for (const [productId, p] of now) {
      const kind = stockCrossing(before.get(productId)?.available ?? p.available, p.available, p.threshold);
      if (kind) await notify(tx, ctx, stockMessage({ kind, productId, name: p.name, available: p.available, unit: p.unit, locationName }));
    }
  };
}

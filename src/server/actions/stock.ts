"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, type Tx } from "@/db";
import { products, purchaseItems, purchases, stockLevels, stockMovements, suppliers } from "@/db/schema";
import { formatQty, unitAllowsDecimals } from "@/lib/format";
import { costAfterPurchaseCancel, EXIT_REASONS, LOSS_REASONS, roundQty, weightedAverageCost } from "@/lib/domain/stock";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext, type BusinessContext } from "../context";
import { watchStock } from "../services/notifications";
import { applyStockMovement, lockStock, reservedQuantities } from "../services/stock";

const positiveQty = z.coerce.number({ message: "Quantité invalide." }).positive("La quantité doit être supérieure à 0.").max(10_000_000);

type ProductInfo = { id: string; name: string; unit: string; costPrice: number };

/** Charge et verrouille les produits du commerce (refuse les produits inconnus ou archivés). */
async function loadProducts(tx: Tx, ctx: BusinessContext, ids: string[]): Promise<Map<string, ProductInfo>> {
  const unique = [...new Set(ids)];
  const rows = await tx
    .select({ id: products.id, name: products.name, unit: products.unit, costPrice: products.costPrice })
    .from(products)
    .where(and(eq(products.businessId, ctx.business.id), inArray(products.id, unique), isNull(products.archivedAt)))
    .for("update");
  if (rows.length !== unique.length) throw new ActionError("Un des produits est introuvable ou archivé.");
  return new Map(rows.map((r) => [r.id, r]));
}

function checkUnit(p: ProductInfo, quantity: number) {
  if (!unitAllowsDecimals(p.unit) && !Number.isInteger(quantity)) {
    throw new ActionError(`« ${p.name} » se compte en unités entières.`);
  }
}

// ── Entrée de stock / achat fournisseur ────────────────────────────────────

const purchaseSchema = z.object({
  supplierId: z.string().nullable().optional(),
  note: z.string().trim().max(300).optional().default(""),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: positiveQty,
        unitCost: z.coerce.number().int("Prix d'achat : nombre entier de FCFA.").min(0).nullable().optional(),
      }),
    )
    .min(1, "Ajoutez au moins un produit.")
    .max(200),
});

export async function createPurchase(input: z.input<typeof purchaseSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("stock.in");
    const data = parse(purchaseSchema, input);
    const withCosts = ctx.can("costs.view");

    if (data.supplierId) {
      const [s] = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(and(eq(suppliers.id, data.supplierId), eq(suppliers.businessId, ctx.business.id)));
      if (!s) throw new ActionError("Fournisseur introuvable.");
    }

    const id = await db.transaction(async (tx) => {
      const map = await loadProducts(
        tx,
        ctx,
        data.items.map((i) => i.productId),
      );
      const items = data.items.map((i) => ({
        ...i,
        unitCost: withCosts && i.unitCost !== null && i.unitCost !== undefined ? i.unitCost : null,
      }));
      items.forEach((i) => checkUnit(map.get(i.productId)!, i.quantity));
      const total = items.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0);

      const [purchase] = await tx
        .insert(purchases)
        .values({
          businessId: ctx.business.id,
          locationId: ctx.location.id,
          supplierId: data.supplierId || null,
          total: Math.round(total),
          note: data.note || null,
          userId: ctx.user.id,
        })
        .returning({ id: purchases.id });

      for (const item of items) {
        const product = map.get(item.productId)!;
        await tx.insert(purchaseItems).values({
          purchaseId: purchase!.id,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        });

        if (item.unitCost !== null) {
          // Coût moyen pondéré sur l'ensemble des boutiques du commerce
          const [stock] = await tx
            .select({ total: sql<string>`coalesce(sum(${stockLevels.quantity}), 0)` })
            .from(stockLevels)
            .where(eq(stockLevels.productId, item.productId));
          const newCost = weightedAverageCost(Number(stock?.total ?? 0), product.costPrice, item.quantity, item.unitCost);
          await tx.update(products).set({ costPrice: newCost }).where(eq(products.id, item.productId));
          product.costPrice = newCost;
        }

        await applyStockMovement(tx, {
          businessId: ctx.business.id,
          locationId: ctx.location.id,
          productId: item.productId,
          quantity: item.quantity,
          type: "purchase",
          refType: "purchase",
          refId: purchase!.id,
          unitCost: item.unitCost ?? product.costPrice,
          userId: ctx.user.id,
        });
      }
      return purchase!.id;
    });

    revalidatePath("/", "layout");
    return { id };
  });
}

// ── Sortie manuelle ou perte ────────────────────────────────────────────────

const exitSchema = z.object({
  productId: z.string().min(1),
  quantity: positiveQty,
  kind: z.enum(["exit", "loss"]),
  reason: z.string(),
  note: z.string().trim().max(300).optional().default(""),
});

export async function createStockExit(input: z.input<typeof exitSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("stock.adjust");
    const data = parse(exitSchema, input);
    const reasons: Record<string, string> = data.kind === "exit" ? EXIT_REASONS : LOSS_REASONS;
    if (!(data.reason in reasons)) throw new ActionError("Choisissez un motif.");

    await db.transaction(async (tx) => {
      const product = (await loadProducts(tx, ctx, [data.productId])).get(data.productId)!;
      checkUnit(product, data.quantity);
      const physical = (await lockStock(tx, ctx.business.id, ctx.location.id, [data.productId])).get(data.productId) ?? 0;
      if (data.quantity > physical) {
        throw new ActionError(`Il ne reste que ${formatQty(physical, product.unit)} de « ${product.name} » ici.`);
      }
      const stockAlerts = await watchStock(tx, ctx, [data.productId]);
      await applyStockMovement(tx, {
        businessId: ctx.business.id,
        locationId: ctx.location.id,
        productId: data.productId,
        quantity: -data.quantity,
        type: data.kind === "exit" ? "out" : "adjust",
        reason: data.reason,
        note: data.note || null,
        unitCost: product.costPrice,
        userId: ctx.user.id,
      });
      await stockAlerts();
    });

    revalidatePath("/", "layout");
    return null;
  });
}

// ── Inventaire ──────────────────────────────────────────────────────────────

const inventorySchema = z.object({
  note: z.string().trim().max(300).optional().default(""),
  counts: z
    .array(z.object({ productId: z.string().min(1), counted: z.coerce.number().min(0, "Quantité comptée invalide.").max(10_000_000) }))
    .min(1, "Saisissez au moins une quantité comptée.")
    .max(2000),
});

export interface InventoryLine {
  productId: string;
  name: string;
  unit: string;
  expected: number;
  counted: number;
  difference: number;
  value: number;
}

export async function submitInventory(input: z.input<typeof inventorySchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("stock.adjust");
    const data = parse(inventorySchema, input);
    const showCost = ctx.can("costs.view");

    const lines = await db.transaction(async (tx) => {
      const ids = data.counts.map((c) => c.productId);
      const map = await loadProducts(tx, ctx, ids);
      const physical = await lockStock(tx, ctx.business.id, ctx.location.id, ids);
      const stockAlerts = await watchStock(tx, ctx, ids);
      const result: InventoryLine[] = [];
      const inventoryId = crypto.randomUUID();

      for (const c of data.counts) {
        const product = map.get(c.productId)!;
        checkUnit(product, c.counted);
        const expected = physical.get(c.productId) ?? 0;
        const difference = roundQty(c.counted - expected);
        // Un produit conforme est aussi gardé (écart 0) : l'inventaire garde la trace de tout ce qui a été compté
        await applyStockMovement(tx, {
          businessId: ctx.business.id,
          locationId: ctx.location.id,
          productId: c.productId,
          quantity: difference,
          type: "inventory",
          reason: "inventory",
          refType: "inventory",
          refId: inventoryId,
          note: data.note || null,
          unitCost: product.costPrice,
          userId: ctx.user.id,
        });
        if (difference === 0) continue;
        result.push({
          productId: c.productId,
          name: product.name,
          unit: product.unit,
          expected,
          counted: c.counted,
          difference,
          value: showCost ? Math.round(difference * product.costPrice) : 0,
        });
      }
      await stockAlerts();
      return { inventoryId, result };
    });

    revalidatePath("/", "layout");
    return { inventoryId: lines.inventoryId, lines: lines.result, checked: data.counts.length };
  });
}

// ── Transfert entre boutiques ──────────────────────────────────────────────

const transferSchema = z.object({
  toLocationId: z.string().min(1, "Choisissez la destination."),
  note: z.string().trim().max(300).optional().default(""),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: positiveQty }))
    .min(1, "Ajoutez au moins un produit.")
    .max(200),
});

export async function createTransfer(input: z.input<typeof transferSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("stock.transfer");
    const data = parse(transferSchema, input);
    const destination = ctx.locations.find((l) => l.id === data.toLocationId);
    if (!destination) throw new ActionError("Destination introuvable.");
    if (destination.id === ctx.location.id) throw new ActionError("La destination doit être différente de la boutique active.");

    await db.transaction(async (tx) => {
      const ids = data.items.map((i) => i.productId);
      const map = await loadProducts(tx, ctx, ids);
      const physical = await lockStock(tx, ctx.business.id, ctx.location.id, ids);
      const reserved = await reservedQuantities(tx, ctx.business.id, ctx.location.id, ids);
      const stockAlerts = await watchStock(tx, ctx, ids);
      const transferId = crypto.randomUUID();
      const totals = new Map<string, number>();
      for (const item of data.items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);

      for (const [productId, quantity] of totals) {
        const product = map.get(productId)!;
        checkUnit(product, quantity);
        const available = roundQty((physical.get(productId) ?? 0) - (reserved.get(productId) ?? 0));
        if (quantity > available) {
          throw new ActionError(`Stock disponible insuffisant pour « ${product.name} » (${formatQty(available, product.unit)}).`);
        }
        const common = {
          businessId: ctx.business.id,
          productId,
          refType: "transfer",
          refId: transferId,
          note: data.note || null,
          unitCost: product.costPrice,
          userId: ctx.user.id,
        };
        await applyStockMovement(tx, { ...common, locationId: ctx.location.id, quantity: -quantity, type: "transfer_out" });
        await applyStockMovement(tx, { ...common, locationId: destination.id, quantity, type: "transfer_in" });
      }
      await stockAlerts();
    });

    revalidatePath("/", "layout");
    return null;
  });
}

// ── Annulations ─────────────────────────────────────────────────────────────

/**
 * Annule une entrée de stock mal saisie : chaque produit ressort de la boutique et le prix d'achat moyen est
 * recalculé sans elle. Refusé si une partie a déjà été vendue ou sortie (on corrige alors le stock du produit).
 */
export async function cancelPurchase(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("stock.cancel");

    await db.transaction(async (tx) => {
      const [purchase] = await tx
        .select()
        .from(purchases)
        .where(and(eq(purchases.id, id), eq(purchases.businessId, ctx.business.id)))
        .for("update");
      if (!purchase) throw new ActionError("Entrée de stock introuvable.");
      if (purchase.cancelledAt) throw new ActionError("Cette entrée est déjà annulée.");

      const items = await tx.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));
      const ids = [...new Set(items.map((i) => i.productId))];
      const rows = await tx
        .select({ id: products.id, name: products.name, unit: products.unit, costPrice: products.costPrice })
        .from(products)
        .where(and(eq(products.businessId, ctx.business.id), inArray(products.id, ids)))
        .for("update");
      const map = new Map(rows.map((r) => [r.id, r]));

      const physical = await lockStock(tx, ctx.business.id, purchase.locationId, ids);
      const reserved = await reservedQuantities(tx, ctx.business.id, purchase.locationId, ids);
      const entered = new Map<string, number>();
      for (const i of items) entered.set(i.productId, roundQty((entered.get(i.productId) ?? 0) + i.quantity));
      for (const [productId, quantity] of entered) {
        const left = roundQty((physical.get(productId) ?? 0) - (reserved.get(productId) ?? 0));
        if (left < quantity) {
          const p = map.get(productId)!;
          throw new ActionError(
            `« ${p.name} » a déjà été vendu ou sorti en partie (il en reste ${formatQty(Math.max(0, left), p.unit)}) : corrigez plutôt son stock dans « Modifier le produit ».`,
          );
        }
      }

      const stockAlerts = await watchStock(tx, ctx, ids, purchase.locationId);
      for (const item of items) {
        const product = map.get(item.productId)!;
        if (item.unitCost !== null) {
          const [stock] = await tx
            .select({ total: sql<string>`coalesce(sum(${stockLevels.quantity}), 0)` })
            .from(stockLevels)
            .where(eq(stockLevels.productId, item.productId));
          const cost = costAfterPurchaseCancel(Number(stock?.total ?? 0), product.costPrice, item.quantity, item.unitCost);
          await tx.update(products).set({ costPrice: cost }).where(eq(products.id, item.productId));
          product.costPrice = cost;
        }
        await applyStockMovement(tx, {
          businessId: ctx.business.id,
          locationId: purchase.locationId,
          productId: item.productId,
          quantity: -item.quantity,
          type: "purchase_cancel",
          refType: "purchase",
          refId: id,
          unitCost: item.unitCost ?? product.costPrice,
          userId: ctx.user.id,
        });
      }
      await tx.update(purchases).set({ cancelledAt: new Date(), cancelledBy: ctx.user.id }).where(eq(purchases.id, id));
      await stockAlerts();
    });

    revalidatePath("/", "layout");
    return null;
  });
}

/** Annule une sortie ou une perte saisie par erreur : le produit revient et la perte sort des rapports. */
export async function cancelStockMovement(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("stock.cancel");

    await db.transaction(async (tx) => {
      const [movement] = await tx
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.id, id), eq(stockMovements.businessId, ctx.business.id)))
        .for("update");
      if (!movement) throw new ActionError("Mouvement introuvable.");
      if ((movement.type !== "out" && movement.type !== "adjust") || movement.refType) {
        throw new ActionError("Seules les sorties et les pertes saisies à la main peuvent être annulées ici.");
      }
      if (movement.cancelledAt) throw new ActionError("Cette sortie est déjà annulée.");

      await lockStock(tx, ctx.business.id, movement.locationId, [movement.productId]);
      await applyStockMovement(tx, {
        businessId: ctx.business.id,
        locationId: movement.locationId,
        productId: movement.productId,
        quantity: -movement.quantity,
        type: "movement_cancel",
        reason: movement.reason,
        refType: "movement",
        refId: movement.id,
        unitCost: movement.unitCost,
        userId: ctx.user.id,
      });
      await tx.update(stockMovements).set({ cancelledAt: new Date() }).where(eq(stockMovements.id, id));
    });

    revalidatePath("/", "layout");
    return null;
  });
}

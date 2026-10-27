import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, products, stockLevels, stockMovements } from "@/db/schema";
import { isUnitId, unitAllowsDecimals } from "@/lib/format";
import { IMPORT_BATCH, normalizeText, productKey } from "@/lib/import/products";

const rowSchema = z.object({
  line: z.number().int().min(1),
  name: z.string().trim().min(2).max(120),
  reference: z.string().trim().max(60),
  category: z.string().trim().max(60),
  unit: z.string().refine(isUnitId, "Unité invalide."),
  costPrice: z.number().int().min(0).max(1_000_000_000),
  salePrice: z.number().int().min(0).max(1_000_000_000),
  stock: z.number().min(0).max(10_000_000),
  alertThreshold: z.number().min(0).max(10_000_000),
});

export const importInputSchema = z.object({
  rows: z.array(rowSchema).min(1).max(IMPORT_BATCH, `Envoyez au plus ${IMPORT_BATCH} lignes à la fois.`),
  /** Produits déjà présents (même référence ou même nom) : on les ignore ou on met à jour prix, catégorie et seuil. */
  existing: z.enum(["ignorer", "mettre-a-jour"]),
});

export type ImportBatchInput = z.input<typeof importInputSchema>;

export interface ImportBatchResult {
  created: number;
  updated: number;
  skipped: { line: number; name: string; reason: string }[];
}

/**
 * Enregistre un lot de produits dans un commerce : création (avec catégories et stock de départ
 * dans la boutique indiquée) ou mise à jour des produits déjà présents, dans la limite de l'essai gratuit (les licences n'en ont pas).
 */
export async function importProductRows(
  target: { businessId: string; locationId: string; userId: string; maxProducts: number | null; planLabel: string; note?: string },
  { rows, existing }: z.output<typeof importInputSchema>,
): Promise<ImportBatchResult> {
  const { businessId, locationId } = target;
  return db.transaction(async (tx) => {
    const out: ImportBatchResult = { created: 0, updated: 0, skipped: [] };

    const current = await tx
      .select({ id: products.id, name: products.name, reference: products.reference })
      .from(products)
      .where(and(eq(products.businessId, businessId), isNull(products.archivedAt)));
    const byName = new Map(current.map((p) => [productKey(p.name), p.id]));
    const byRef = new Map(current.filter((p) => p.reference).map((p) => [normalizeText(p.reference), p.id]));

    // Catégories : on réutilise celles qui existent (sans tenir compte des majuscules/accents)
    const cats = await tx.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.businessId, businessId));
    const catByName = new Map(cats.map((c) => [normalizeText(c.name), c.id]));
    const categoryId = async (name: string): Promise<string | null> => {
      if (!name) return null;
      const key = normalizeText(name);
      const found = catByName.get(key);
      if (found) return found;
      const [created] = await tx.insert(categories).values({ businessId, name }).onConflictDoNothing().returning({ id: categories.id });
      const id =
        created?.id ??
        (await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.businessId, businessId), eq(categories.name, name))))[0]?.id;
      if (id) catByName.set(key, id);
      return id ?? null;
    };

    const max = target.maxProducts;
    let room = max === null ? Number.POSITIVE_INFINITY : Math.max(0, max - current.length);

    const newProducts: (typeof products.$inferInsert)[] = [];
    const newStock: { productId: string; quantity: number; unitCost: number }[] = [];

    for (const r of rows) {
      const id = (r.reference && byRef.get(normalizeText(r.reference))) || byName.get(productKey(r.name));
      if (id) {
        if (existing === "ignorer") {
          out.skipped.push({ line: r.line, name: r.name, reason: "Existe déjà" });
          continue;
        }
        await tx
          .update(products)
          .set({
            salePrice: r.salePrice,
            ...(r.costPrice > 0 ? { costPrice: r.costPrice } : {}),
            ...(r.alertThreshold > 0 ? { alertThreshold: r.alertThreshold } : {}),
            ...(r.category ? { categoryId: await categoryId(r.category) } : {}),
            ...(r.reference ? { reference: r.reference } : {}),
          })
          .where(and(eq(products.id, id), eq(products.businessId, businessId)));
        out.updated++;
        continue;
      }
      if (room <= 0) {
        out.skipped.push({ line: r.line, name: r.name, reason: `Limite de ${max} produits (${target.planLabel.toLowerCase()})` });
        continue;
      }
      const decimals = unitAllowsDecimals(r.unit);
      const productId = crypto.randomUUID();
      newProducts.push({
        id: productId,
        businessId,
        name: r.name,
        reference: r.reference || null,
        unit: r.unit,
        categoryId: await categoryId(r.category),
        salePrice: r.salePrice,
        costPrice: r.costPrice,
        alertThreshold: decimals ? r.alertThreshold : Math.round(r.alertThreshold),
      });
      const qty = decimals ? r.stock : Math.round(r.stock);
      if (qty > 0) newStock.push({ productId, quantity: qty, unitCost: r.costPrice });
      byName.set(productKey(r.name), productId);
      if (r.reference) byRef.set(normalizeText(r.reference), productId);
      room--;
      out.created++;
    }

    if (newProducts.length > 0) await tx.insert(products).values(newProducts);
    if (newStock.length > 0) {
      await tx.insert(stockLevels).values(newStock.map((s) => ({ businessId, productId: s.productId, locationId, quantity: s.quantity })));
      await tx.insert(stockMovements).values(
        newStock.map((s) => ({
          businessId,
          locationId,
          productId: s.productId,
          type: "initial",
          quantity: s.quantity,
          unitCost: s.unitCost,
          note: target.note ?? "Import Excel",
          userId: target.userId,
        })),
      );
    }
    return out;
  });
}

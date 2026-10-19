"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { isUnitId, unitAllowsDecimals } from "@/lib/format";
import { canAdd } from "@/lib/domain/plans";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext, type BusinessContext } from "../context";
import { countActiveProducts } from "../queries/products";
import { applyStockMovement } from "../services/stock";

const money = (label: string) =>
  z.coerce
    .number({ message: `${label} invalide.` })
    .int(`${label} : utilisez un nombre entier de FCFA.`)
    .min(0, `${label} ne peut pas être négatif.`)
    .max(1_000_000_000, `${label} trop élevé.`);

const quantity = z.coerce.number({ message: "Quantité invalide." }).min(0, "La quantité ne peut pas être négative.").max(10_000_000);

const productSchema = z.object({
  name: z.string().trim().min(2, "Le nom du produit est trop court.").max(120),
  reference: z.string().trim().max(60).optional().default(""),
  unit: z.string().refine(isUnitId, "Unité invalide."),
  categoryId: z.string().optional().nullable(),
  newCategory: z.string().trim().max(60).optional().default(""),
  salePrice: money("Le prix de vente"),
  costPrice: money("Le prix d'achat"),
  alertThreshold: quantity,
  initialStock: quantity.optional().default(0),
  imageData: z
    .string()
    .max(600_000, "La photo est trop lourde.")
    .refine((v) => v === "" || /^data:image\/(webp|jpeg|png);base64,/.test(v), "Photo invalide.")
    .nullable()
    .optional(),
});

export type ProductInput = z.input<typeof productSchema>;

function checkDecimals(unit: string, values: number[]) {
  if (!unitAllowsDecimals(unit) && values.some((v) => !Number.isInteger(v))) {
    throw new ActionError("Cette unité ne permet pas les quantités à virgule (utilisez kg, m ou litre).");
  }
}

async function resolveCategory(ctx: BusinessContext, categoryId: string | null | undefined, newCategory: string) {
  if (newCategory) {
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.businessId, ctx.business.id), eq(categories.name, newCategory)));
    if (existing) return existing.id;
    const [created] = await db
      .insert(categories)
      .values({ businessId: ctx.business.id, name: newCategory })
      .returning({ id: categories.id });
    return created!.id;
  }
  if (!categoryId) return null;
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.businessId, ctx.business.id)));
  if (!cat) throw new ActionError("Catégorie introuvable.");
  return cat.id;
}

function limitMessage(ctx: BusinessContext) {
  const max = ctx.plan.limits.maxProducts;
  return ctx.plan.plan === "trial"
    ? `L'essai est limité à ${max} produits. Passez à la formule Pro pour en ajouter davantage.`
    : `Votre formule ${ctx.plan.label} est limitée à ${max} produits. Passez à Business pour des produits illimités.`;
}

export async function createProduct(input: ProductInput) {
  return runAction(async () => {
    const ctx = await requireActionContext("products.manage");
    const data = parse(productSchema, input);
    checkDecimals(data.unit, [data.alertThreshold, data.initialStock]);

    if (!canAdd(ctx.plan.limits.maxProducts, await countActiveProducts(ctx.business.id))) {
      throw new ActionError(limitMessage(ctx));
    }
    const categoryId = await resolveCategory(ctx, data.categoryId, data.newCategory);

    const id = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(products)
        .values({
          businessId: ctx.business.id,
          name: data.name,
          reference: data.reference || null,
          unit: data.unit,
          categoryId,
          salePrice: data.salePrice,
          costPrice: data.costPrice,
          alertThreshold: data.alertThreshold,
          imageData: data.imageData || null,
        })
        .returning({ id: products.id });
      if (data.initialStock > 0) {
        await applyStockMovement(tx, {
          businessId: ctx.business.id,
          locationId: ctx.location.id,
          productId: p!.id,
          quantity: data.initialStock,
          type: "initial",
          unitCost: data.costPrice,
          userId: ctx.user.id,
        });
      }
      return p!.id;
    });

    revalidatePath("/", "layout");
    return { id };
  });
}

export async function updateProduct(id: string, input: ProductInput) {
  return runAction(async () => {
    const ctx = await requireActionContext("products.manage");
    const data = parse(productSchema, input);
    checkDecimals(data.unit, [data.alertThreshold]);
    const categoryId = await resolveCategory(ctx, data.categoryId, data.newCategory);

    const updated = await db
      .update(products)
      .set({
        name: data.name,
        reference: data.reference || null,
        unit: data.unit,
        categoryId,
        salePrice: data.salePrice,
        costPrice: data.costPrice,
        alertThreshold: data.alertThreshold,
        ...(data.imageData !== undefined ? { imageData: data.imageData || null } : {}),
      })
      .where(and(eq(products.id, id), eq(products.businessId, ctx.business.id)))
      .returning({ id: products.id });
    if (updated.length === 0) throw new ActionError("Produit introuvable.");

    revalidatePath("/", "layout");
    return { id };
  });
}

export async function setProductArchived(id: string, archived: boolean) {
  return runAction(async () => {
    const ctx = await requireActionContext("products.manage");
    if (!archived && !canAdd(ctx.plan.limits.maxProducts, await countActiveProducts(ctx.business.id))) {
      throw new ActionError(limitMessage(ctx));
    }
    const updated = await db
      .update(products)
      .set({ archivedAt: archived ? new Date() : null })
      .where(
        and(
          eq(products.id, id),
          eq(products.businessId, ctx.business.id),
          archived ? isNull(products.archivedAt) : undefined,
        ),
      )
      .returning({ id: products.id });
    if (updated.length === 0) throw new ActionError("Produit introuvable.");
    revalidatePath("/", "layout");
    return null;
  });
}

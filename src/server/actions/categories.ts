"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";

const nameSchema = z.string().trim().min(2, "Le nom de la catégorie est trop court.").max(60, "Nom trop long (60 caractères au plus).");

async function assertFree(businessId: string, name: string, exceptId?: string) {
  const conditions = [eq(categories.businessId, businessId), eq(categories.name, name)];
  if (exceptId) conditions.push(ne(categories.id, exceptId));
  const [dup] = await db.select({ id: categories.id }).from(categories).where(and(...conditions));
  if (dup) throw new ActionError("Une catégorie porte déjà ce nom.");
}

function refresh() {
  revalidatePath("/categories");
  revalidatePath("/produits");
  revalidatePath("/rapports");
}

export async function createCategory(name: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("products.manage");
    const clean = parse(nameSchema, name);
    await assertFree(ctx.business.id, clean);
    await db.insert(categories).values({ businessId: ctx.business.id, name: clean });
    refresh();
    return null;
  });
}

export async function renameCategory(id: string, name: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("products.manage");
    const clean = parse(nameSchema, name);
    await assertFree(ctx.business.id, clean, id);
    const updated = await db
      .update(categories)
      .set({ name: clean })
      .where(and(eq(categories.id, id), eq(categories.businessId, ctx.business.id)))
      .returning({ id: categories.id });
    if (updated.length === 0) throw new ActionError("Catégorie introuvable.");
    refresh();
    return null;
  });
}

/** Supprime la catégorie : ses produits sont conservés, simplement « sans catégorie ». */
export async function deleteCategory(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("products.manage");
    const deleted = await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.businessId, ctx.business.id)))
      .returning({ id: categories.id });
    if (deleted.length === 0) throw new ActionError("Catégorie introuvable.");
    refresh();
    return null;
  });
}

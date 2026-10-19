"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { normalizePhone } from "@/lib/format";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Le nom du fournisseur est trop court.").max(100),
  phone: z.string().trim().optional().default(""),
  note: z.string().trim().max(300).optional().default(""),
});

function cleanPhone(phone: string) {
  if (!phone) return null;
  const p = normalizePhone(phone);
  if (!p) throw new ActionError("Numéro de téléphone invalide (ex. 77 123 45 67).");
  return p;
}

export async function createSupplier(input: z.input<typeof supplierSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("suppliers.manage");
    const data = parse(supplierSchema, input);
    const [s] = await db
      .insert(suppliers)
      .values({ businessId: ctx.business.id, name: data.name, phone: cleanPhone(data.phone), note: data.note || null })
      .returning({ id: suppliers.id, name: suppliers.name });
    revalidatePath("/", "layout");
    return s!;
  });
}

export async function updateSupplier(id: string, input: z.input<typeof supplierSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("suppliers.manage");
    const data = parse(supplierSchema, input);
    const updated = await db
      .update(suppliers)
      .set({ name: data.name, phone: cleanPhone(data.phone), note: data.note || null })
      .where(and(eq(suppliers.id, id), eq(suppliers.businessId, ctx.business.id)))
      .returning({ id: suppliers.id, name: suppliers.name });
    if (updated.length === 0) throw new ActionError("Fournisseur introuvable.");
    revalidatePath("/", "layout");
    return updated[0]!;
  });
}

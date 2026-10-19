"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { customerPayments, customers, sales } from "@/db/schema";
import { formatFCFA, normalizePhone } from "@/lib/format";
import { PAYING_METHODS } from "@/lib/domain/sales";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext } from "../context";
import { COMPLETED_SALE } from "../queries/customers";

const customerSchema = z.object({
  name: z.string().trim().min(2, "Le nom du client est trop court.").max(100),
  phone: z.string().trim().optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  note: z.string().trim().max(300).optional().default(""),
});

function cleanPhone(phone: string) {
  if (!phone) return null;
  const p = normalizePhone(phone);
  if (!p) throw new ActionError("Numéro de téléphone invalide (ex. 77 123 45 67).");
  return p;
}

export async function createCustomer(input: z.input<typeof customerSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("customers.manage");
    const data = parse(customerSchema, input);
    const [c] = await db
      .insert(customers)
      .values({
        businessId: ctx.business.id,
        name: data.name,
        phone: cleanPhone(data.phone),
        address: data.address || null,
        note: data.note || null,
      })
      .returning({ id: customers.id, name: customers.name, phone: customers.phone });
    revalidatePath("/", "layout");
    return c!;
  });
}

export async function updateCustomer(id: string, input: z.input<typeof customerSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("customers.manage");
    const data = parse(customerSchema, input);
    const updated = await db
      .update(customers)
      .set({ name: data.name, phone: cleanPhone(data.phone), address: data.address || null, note: data.note || null })
      .where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id)))
      .returning({ id: customers.id, name: customers.name, phone: customers.phone });
    if (updated.length === 0) throw new ActionError("Client introuvable.");
    revalidatePath("/", "layout");
    return updated[0]!;
  });
}

const paymentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.coerce.number().int("Montant en FCFA entiers.").positive("Le montant doit être supérieur à 0."),
  method: z.enum(PAYING_METHODS, { message: "Choisissez un mode de paiement." }),
  note: z.string().trim().max(300).optional().default(""),
});

/** Enregistre un remboursement et l'impute aux ventes impayées les plus anciennes. */
export async function recordCustomerPayment(input: z.input<typeof paymentSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("customers.manage");
    const data = parse(paymentSchema, input);

    await db.transaction(async (tx) => {
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, data.customerId), eq(customers.businessId, ctx.business.id)));
      if (!customer) throw new ActionError("Client introuvable.");

      const unpaid = await tx
        .select({ id: sales.id, total: sales.total, amountPaid: sales.amountPaid })
        .from(sales)
        .where(
          and(
            eq(sales.businessId, ctx.business.id),
            eq(sales.customerId, data.customerId),
            COMPLETED_SALE,
            sql`${sales.total} > ${sales.amountPaid}`,
          ),
        )
        .orderBy(asc(sales.completedAt))
        .for("update");

      const debt = unpaid.reduce((s, r) => s + r.total - r.amountPaid, 0);
      if (debt === 0) throw new ActionError("Ce client ne doit rien.");
      if (data.amount > debt) throw new ActionError(`Le montant dépasse la dette du client (${formatFCFA(debt)}).`);

      let remaining = data.amount;
      for (const row of unpaid) {
        if (remaining <= 0) break;
        const part = Math.min(remaining, row.total - row.amountPaid);
        await tx.update(sales).set({ amountPaid: row.amountPaid + part }).where(eq(sales.id, row.id));
        remaining -= part;
      }

      await tx.insert(customerPayments).values({
        businessId: ctx.business.id,
        customerId: data.customerId,
        amount: data.amount,
        method: data.method,
        note: data.note || null,
        userId: ctx.user.id,
      });
    });

    revalidatePath("/", "layout");
    return null;
  });
}

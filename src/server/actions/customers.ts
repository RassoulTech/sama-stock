"use server";

import { and, asc, eq, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { customerPayments, customers, sales } from "@/db/schema";
import { formatFCFA, normalizePhone } from "@/lib/format";
import { allocatePayment, paymentReversal } from "@/lib/domain/payments";
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

/**
 * Supprime un client qui ne doit rien et n'a pas de commande en cours. Ses ventes passées restent dans les ventes et
 * les rapports (sans nom de client), ses factures gardent son nom imprimé ; ses remboursements sont effacés avec lui.
 */
export async function deleteCustomer(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("customers.manage");
    await db.transaction(async (tx) => {
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id)))
        .for("update");
      if (!customer) throw new ActionError("Client introuvable.");

      const [row] = await tx
        .select({
          debt: sql<number>`coalesce(sum(${sales.total} - ${sales.amountPaid}) filter (where ${COMPLETED_SALE}), 0)::int`,
          openOrders: sql<number>`(count(*) filter (where ${sales.kind} = 'order' and ${sales.status} in ('new', 'preparing', 'shipping')))::int`,
        })
        .from(sales)
        .where(and(eq(sales.businessId, ctx.business.id), eq(sales.customerId, id)));
      const debt = Number(row?.debt ?? 0);
      if (debt > 0) throw new ActionError(`Ce client vous doit encore ${formatFCFA(debt)}. Enregistrez son paiement avant de le supprimer.`);
      if (Number(row?.openOrders ?? 0) > 0) {
        throw new ActionError("Ce client a une commande en cours. Livrez-la ou annulez-la avant de le supprimer.");
      }
      await tx.delete(customers).where(eq(customers.id, id));
    });
    revalidatePath("/", "layout");
    return null;
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

      const parts = allocatePayment(data.amount, unpaid);
      const paid = new Map(unpaid.map((r) => [r.id, r.amountPaid]));
      for (const part of parts) {
        await tx.update(sales).set({ amountPaid: paid.get(part.saleId)! + part.amount }).where(eq(sales.id, part.saleId));
      }

      await tx.insert(customerPayments).values({
        businessId: ctx.business.id,
        customerId: data.customerId,
        amount: data.amount,
        method: data.method,
        note: data.note || null,
        userId: ctx.user.id,
        // Gardé pour pouvoir annuler ce paiement sur les bonnes ventes
        allocations: parts,
      });
    });

    revalidatePath("/", "layout");
    return null;
  });
}

/** Annule un remboursement saisi par erreur : la dette revient sur les ventes qu'il avait remboursées. */
export async function cancelCustomerPayment(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("payments.cancel");

    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(customerPayments)
        .where(and(eq(customerPayments.id, id), eq(customerPayments.businessId, ctx.business.id)))
        .for("update");
      if (!payment) throw new ActionError("Paiement introuvable.");
      if (payment.cancelledAt) throw new ActionError("Ce paiement est déjà annulé.");

      const paidSales = await tx
        .select({ id: sales.id, amountPaid: sales.amountPaid, paymentMethod: sales.paymentMethod, completedAt: sales.completedAt })
        .from(sales)
        .where(
          and(
            eq(sales.businessId, ctx.business.id),
            eq(sales.customerId, payment.customerId),
            COMPLETED_SALE,
            sql`${sales.amountPaid} > 0`,
            // Un paiement d'avant la répartition n'a pu rembourser que des ventes plus anciennes que lui
            ...(payment.allocations ? [] : [lte(sales.completedAt, payment.createdAt)]),
          ),
        )
        .for("update");
      const parts = paymentReversal(
        payment.amount,
        payment.allocations ?? null,
        paidSales.map((s) => ({ id: s.id, amountPaid: s.amountPaid, credit: s.paymentMethod === "credit", completedAt: s.completedAt ?? payment.createdAt })),
      );
      for (const part of parts) {
        await tx
          .update(sales)
          .set({ amountPaid: sql`${sales.amountPaid} - ${part.amount}` })
          .where(eq(sales.id, part.saleId));
      }
      await tx.update(customerPayments).set({ cancelledAt: new Date(), cancelledBy: ctx.user.id }).where(eq(customerPayments.id, id));
    });

    revalidatePath("/", "layout");
    return null;
  });
}

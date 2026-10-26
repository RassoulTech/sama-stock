"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { customers, documentItems, documents, products, saleItems, sales } from "@/db/schema";
import { roundQty } from "@/lib/domain/stock";
import { SALE_METHODS } from "@/lib/domain/sales";
import { normalizePhone, unitAllowsDecimals } from "@/lib/format";
import { ActionError, parse, runAction } from "../action";
import { requireActionContext, type BusinessContext } from "../context";
import { nextDocumentNumber, sellerSnapshot } from "../services/documents";
import { priceAndReserve } from "../services/sale-lines";
import { recordShopSale } from "../services/shop-sale";

const partySchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom du client.").max(120),
  phone: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v, c) => {
      if (!v) return null;
      const p = normalizePhone(v);
      if (!p) {
        c.addIssue({ code: "custom", message: "Numéro de téléphone du client invalide (ex. 77 123 45 67)." });
        return z.NEVER;
      }
      return p;
    }),
  address: z.string().trim().max(160).optional().default(""),
  ninea: z.string().trim().toUpperCase().max(30, "NINEA du client trop long.").optional().default(""),
});

/** Un vendeur ne touche qu'aux devis qu'il a faits (comme il ne voit que les siens). */
const ownQuotes = (ctx: BusinessContext) => (ctx.can("dashboard.full") ? [] : [eq(documents.createdBy, ctx.user.id)]);

const cleanParty = (p: z.infer<typeof partySchema>) => ({
  name: p.name,
  phone: p.phone,
  address: p.address || null,
  ninea: p.ninea || null,
});

/** Facture d'une vente (terminée) ou d'une commande (non annulée). Si elle existe déjà, on la renvoie. */
export async function createInvoiceFromSale(saleId: string, input: { customer: z.input<typeof partySchema> }) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.create");
    const party = cleanParty(parse(partySchema, input.customer));

    const id = await db.transaction(async (tx) => {
      const [sale] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, saleId), eq(sales.businessId, ctx.business.id)))
        .for("update");
      if (!sale) throw new ActionError("Vente introuvable.");
      if (sale.kind === "sale" && !ctx.can("dashboard.full") && sale.userId !== ctx.user.id) {
        throw new ActionError("Vente introuvable.");
      }
      if (sale.kind === "sale" ? sale.status !== "completed" : sale.status === "cancelled" || sale.status === "returned") {
        throw new ActionError("On ne peut pas facturer une vente ou une commande annulée.");
      }
      const [existing] = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.saleId, saleId), eq(documents.type, "facture"), eq(documents.status, "emise")));
      if (existing) return existing.id;

      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
      const [doc] = await tx
        .insert(documents)
        .values({
          businessId: ctx.business.id,
          type: "facture",
          number: await nextDocumentNumber(tx, ctx.business.id, "facture"),
          status: "emise",
          saleId,
          customerId: sale.customerId,
          customer: party,
          seller: sellerSnapshot(ctx.business),
          vatRate: ctx.business.vatRate === 18 ? 18 : 0,
          subtotal: sale.subtotal,
          discount: sale.discount,
          deliveryFee: sale.deliveryFee,
          total: sale.total,
          footer: ctx.business.documentFooter,
          createdBy: ctx.user.id,
        })
        .returning({ id: documents.id });
      if (items.length > 0) {
        await tx.insert(documentItems).values(
          items.map((i, position) => ({
            documentId: doc!.id,
            productId: i.productId,
            name: i.name,
            unit: i.unit,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
            position,
          })),
        );
      }
      return doc!.id;
    });

    revalidatePath("/factures");
    revalidatePath(`/ventes/${saleId}`);
    revalidatePath(`/commandes/${saleId}`);
    return { id };
  });
}

export async function cancelInvoice(id: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.cancel");
    const done = await db
      .update(documents)
      .set({ status: "annulee", cancelledAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.businessId, ctx.business.id), eq(documents.type, "facture"), eq(documents.status, "emise")))
      .returning({ saleId: documents.saleId });
    if (done.length === 0) throw new ActionError("Cette facture est introuvable ou déjà annulée.");
    revalidatePath("/factures", "layout");
    if (done[0]!.saleId) {
      revalidatePath(`/ventes/${done[0]!.saleId}`);
      revalidatePath(`/commandes/${done[0]!.saleId}`);
    }
    return null;
  });
}

const quoteSchema = z.object({
  customerId: z.string().nullable().optional(),
  customer: partySchema,
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().positive("Quantité invalide.").max(10_000_000),
        unitPrice: z.coerce.number().int("Prix en FCFA entiers.").min(0, "Prix invalide.").max(1_000_000_000),
      }),
    )
    .min(1, "Ajoutez au moins un produit.")
    .max(200),
  discount: z.coerce.number().int().min(0, "Remise invalide.").default(0),
  deliveryFee: z.coerce.number().int().min(0, "Frais de livraison invalides.").default(0),
  validUntil: z.iso.date("Date de validité invalide."),
  note: z.string().trim().max(500).optional().default(""),
});

/** Crée un devis, ou le modifie tant qu'il n'est pas transformé en vente. */
export async function saveQuote(id: string | null, input: z.input<typeof quoteSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.create");
    const data = parse(quoteSchema, input);
    const validUntil = new Date(`${data.validUntil}T23:59:59Z`);

    // Une même ligne produit : on additionne les quantités et on garde le premier prix
    const merged = new Map<string, { quantity: number; unitPrice: number }>();
    for (const l of data.items) {
      const prev = merged.get(l.productId);
      merged.set(l.productId, { quantity: roundQty((prev?.quantity ?? 0) + l.quantity), unitPrice: prev?.unitPrice ?? l.unitPrice });
    }

    const docId = await db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: products.id, name: products.name, unit: products.unit })
        .from(products)
        .where(and(eq(products.businessId, ctx.business.id), inArray(products.id, [...merged.keys()]), isNull(products.archivedAt)));
      if (rows.length !== merged.size) throw new ActionError("Un des produits est introuvable ou archivé.");
      const byId = new Map(rows.map((r) => [r.id, r]));
      const lines = [...merged.entries()].map(([productId, l], position) => {
        const p = byId.get(productId)!;
        if (!unitAllowsDecimals(p.unit) && !Number.isInteger(l.quantity)) throw new ActionError(`« ${p.name} » se vend en unités entières.`);
        return { productId, name: p.name, unit: p.unit, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: Math.round(l.quantity * l.unitPrice), position };
      });
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      if (data.discount > subtotal) throw new ActionError("La remise dépasse le montant des produits.");

      let customerId: string | null = null;
      let party = cleanParty(data.customer);
      if (data.customerId) {
        const [c] = await tx
          .select({ id: customers.id, name: customers.name, phone: customers.phone, address: customers.address })
          .from(customers)
          .where(and(eq(customers.id, data.customerId), eq(customers.businessId, ctx.business.id)));
        if (!c) throw new ActionError("Client introuvable.");
        customerId = c.id;
        party = { name: c.name, phone: c.phone, address: party.address || c.address, ninea: party.ninea };
      }

      const values = {
        customerId,
        customer: party,
        seller: sellerSnapshot(ctx.business),
        vatRate: ctx.business.vatRate === 18 ? 18 : 0,
        subtotal,
        discount: data.discount,
        deliveryFee: data.deliveryFee,
        total: subtotal - data.discount + data.deliveryFee,
        validUntil,
        note: data.note || null,
        footer: ctx.business.documentFooter,
      };

      let targetId: string;
      if (id) {
        const [current] = await tx
          .select({ status: documents.status })
          .from(documents)
          .where(and(eq(documents.id, id), eq(documents.businessId, ctx.business.id), eq(documents.type, "devis"), ...ownQuotes(ctx)))
          .for("update");
        if (!current) throw new ActionError("Devis introuvable.");
        if (current.status === "converti") throw new ActionError("Ce devis est déjà transformé en vente : il ne peut plus être modifié.");
        await tx.update(documents).set(values).where(eq(documents.id, id));
        await tx.delete(documentItems).where(eq(documentItems.documentId, id));
        targetId = id;
      } else {
        const [doc] = await tx
          .insert(documents)
          .values({
            businessId: ctx.business.id,
            type: "devis",
            number: await nextDocumentNumber(tx, ctx.business.id, "devis"),
            status: "en_cours",
            createdBy: ctx.user.id,
            ...values,
          })
          .returning({ id: documents.id });
        targetId = doc!.id;
      }
      await tx.insert(documentItems).values(lines.map((l) => ({ documentId: targetId, ...l })));
      return targetId;
    });

    revalidatePath("/factures", "layout");
    return { id: docId };
  });
}

export async function setQuoteStatus(id: string, status: string) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.create");
    const to = parse(z.enum(["en_cours", "accepte", "refuse"], { message: "Statut inconnu." }), status);
    const done = await db
      .update(documents)
      .set({ status: to })
      .where(
        and(
          eq(documents.id, id),
          eq(documents.businessId, ctx.business.id),
          eq(documents.type, "devis"),
          inArray(documents.status, ["en_cours", "accepte", "refuse"]),
          ...ownQuotes(ctx),
        ),
      )
      .returning({ id: documents.id });
    if (done.length === 0) throw new ActionError("Ce devis est introuvable ou déjà transformé en vente.");
    revalidatePath("/factures", "layout");
    return null;
  });
}

const convertSchema = z.object({
  paymentMethod: z.enum(SALE_METHODS, { message: "Choisissez le mode de paiement." }),
  amountReceived: z.coerce.number().int().min(0).default(0),
});

/** Transforme un devis en vente, aux prix du devis : le stock baisse et le devis est marqué « transformé ». */
export async function convertQuoteToSale(id: string, input: z.input<typeof convertSchema>) {
  return runAction(async () => {
    const ctx = await requireActionContext("sales.create");
    if (!ctx.business.modulePos) throw new ActionError("La caisse n'est pas activée pour ce commerce.");
    const data = parse(convertSchema, input);

    const saleId = await db.transaction(async (tx) => {
      const [quote] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.businessId, ctx.business.id), eq(documents.type, "devis"), ...ownQuotes(ctx)))
        .for("update");
      if (!quote) throw new ActionError("Devis introuvable.");
      if (quote.status === "converti") throw new ActionError("Ce devis est déjà transformé en vente.");
      if (quote.status === "refuse") throw new ActionError("Ce devis est refusé. Remettez-le « en cours » pour le transformer.");

      const items = await tx.select().from(documentItems).where(eq(documentItems.documentId, id));
      if (items.length === 0 || items.some((i) => !i.productId)) {
        throw new ActionError("Un produit de ce devis n'existe plus. Modifiez le devis avant de le transformer.");
      }
      const lines = await priceAndReserve(
        tx,
        ctx,
        items.map((i) => ({ productId: i.productId!, quantity: i.quantity })),
        { prices: new Map(items.map((i) => [i.productId!, i.unitPrice])) },
      );
      const newSaleId = await recordShopSale(tx, ctx, {
        lines,
        discount: quote.discount,
        deliveryFee: quote.deliveryFee,
        customerId: quote.customerId,
        paymentMethod: data.paymentMethod,
        amountReceived: data.amountReceived,
        note: `Devis ${quote.number}`,
      });
      await tx.update(documents).set({ status: "converti", saleId: newSaleId }).where(eq(documents.id, id));
      return newSaleId;
    });

    revalidatePath("/", "layout");
    return { saleId };
  });
}

import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { businesses, customers, documentItems, documents, saleItems, sales, user, type DocumentParty } from "@/db/schema";
import type { PublicDocKind } from "@/lib/domain/document-token";
import type { DocumentType } from "@/lib/domain/documents";
import type { BusinessContext } from "../context";

const linkedSale = alias(sales, "linked_sale");

/** Une page de factures ou de devis, et leur nombre total. */
export async function listDocuments(ctx: BusinessContext, type: DocumentType, page: { limit: number; offset: number }) {
  const conditions: SQL[] = [eq(documents.businessId, ctx.business.id), eq(documents.type, type)];
  // Un vendeur ne voit que les documents qu'il a faits
  if (!ctx.can("dashboard.full")) conditions.push(eq(documents.createdBy, ctx.user.id));
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(documents).where(and(...conditions));
  const rows = await db
    .select({
      id: documents.id,
      number: documents.number,
      status: documents.status,
      customer: documents.customer,
      total: documents.total,
      createdAt: documents.createdAt,
      validUntil: documents.validUntil,
      saleId: documents.saleId,
      saleNumber: linkedSale.number,
      saleKind: linkedSale.kind,
      saleTotal: linkedSale.total,
      saleAmountPaid: linkedSale.amountPaid,
    })
    .from(documents)
    .leftJoin(linkedSale, eq(documents.saleId, linkedSale.id))
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt), desc(documents.id))
    .limit(page.limit)
    .offset(page.offset);
  return { rows, total: count?.total ?? 0 };
}

export type DocumentListRow = Awaited<ReturnType<typeof listDocuments>>["rows"][number];

export async function getDocument(ctx: BusinessContext, id: string) {
  const [row] = await db
    .select({ doc: documents, sale: { id: linkedSale.id, number: linkedSale.number, kind: linkedSale.kind, status: linkedSale.status, total: linkedSale.total, amountPaid: linkedSale.amountPaid, paymentMethod: linkedSale.paymentMethod } })
    .from(documents)
    .leftJoin(linkedSale, eq(documents.saleId, linkedSale.id))
    .where(and(eq(documents.id, id), eq(documents.businessId, ctx.business.id)));
  if (!row) return null;
  if (!ctx.can("dashboard.full") && row.doc.createdBy !== ctx.user.id) return null;
  const items = await db.select().from(documentItems).where(eq(documentItems.documentId, id)).orderBy(asc(documentItems.position));
  return { ...row.doc, sale: row.sale?.id ? row.sale : null, items };
}

export type DocumentDetail = NonNullable<Awaited<ReturnType<typeof getDocument>>>;

/** Facture valable d'une vente ou commande, s'il y en a une. */
export async function invoiceOfSale(businessId: string, saleId: string) {
  const [row] = await db
    .select({ id: documents.id, number: documents.number })
    .from(documents)
    .where(and(eq(documents.businessId, businessId), eq(documents.saleId, saleId), eq(documents.type, "facture"), eq(documents.status, "emise")));
  return row ?? null;
}

export interface PublicLine {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** Tout ce qu'il faut pour la page d'authenticité et le PDF, sans session (lien signé). */
export interface PublicDocument {
  kind: PublicDocKind;
  id: string;
  number: string;
  date: Date;
  validUntil: Date | null;
  /** Pour un devis : statut affichable ; pour une facture : emise | annulee ; pour un reçu : completed | cancelled. */
  status: string;
  seller: DocumentParty;
  logo: string | null;
  brandColor: string | null;
  customer: DocumentParty | null;
  sellerName: string | null;
  lines: PublicLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  vatRate: number;
  /** Paiement lu en direct sur la vente (facture, reçu). */
  payment: { paid: number; method: string | null; cancelled: boolean } | null;
  note: string | null;
  footer: string | null;
}

const sellerUser = alias(user, "seller_user");

export async function getPublicDocument(kind: PublicDocKind, id: string): Promise<PublicDocument | null> {
  if (kind === "recu") {
    const [row] = await db
      .select({ sale: sales, business: businesses, sellerName: sellerUser.name })
      .from(sales)
      .innerJoin(businesses, eq(sales.businessId, businesses.id))
      .leftJoin(sellerUser, eq(sales.userId, sellerUser.id))
      .where(and(eq(sales.id, id), eq(sales.kind, "sale")));
    if (!row) return null;
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id));
    const { sale, business: b } = row;
    const [customer] = sale.customerId
      ? await db.select({ name: customers.name, phone: customers.phone, address: customers.address }).from(customers).where(eq(customers.id, sale.customerId))
      : [];
    return {
      kind,
      id,
      number: sale.number,
      date: sale.createdAt,
      validUntil: null,
      status: sale.status,
      seller: { name: b.name, phone: b.phone, address: b.address, city: b.city, ninea: b.ninea, rccm: b.rccm },
      logo: b.logo,
      brandColor: b.licensePack ? b.brandColor : null,
      customer: customer ?? null,
      sellerName: isTechnicalName(row.sellerName) ? null : row.sellerName,
      lines: items.map((i) => ({ name: i.name, unit: i.unit, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      deliveryFee: sale.deliveryFee,
      total: sale.total,
      vatRate: 0,
      payment: { paid: sale.amountPaid, method: sale.paymentMethod, cancelled: sale.status === "cancelled" },
      note: null,
      footer: b.documentFooter,
    };
  }

  const [row] = await db
    .select({
      doc: documents,
      logo: businesses.logo,
      brandColor: businesses.brandColor,
      licensePack: businesses.licensePack,
      sale: { id: linkedSale.id, status: linkedSale.status, amountPaid: linkedSale.amountPaid, paymentMethod: linkedSale.paymentMethod },
    })
    .from(documents)
    .innerJoin(businesses, eq(documents.businessId, businesses.id))
    .leftJoin(linkedSale, eq(documents.saleId, linkedSale.id))
    .where(and(eq(documents.id, id), eq(documents.type, kind)));
  if (!row) return null;
  const { doc } = row;
  const items = await db.select().from(documentItems).where(eq(documentItems.documentId, id)).orderBy(asc(documentItems.position));
  return {
    kind,
    id,
    number: doc.number,
    date: doc.createdAt,
    validUntil: doc.validUntil,
    status: doc.status,
    seller: doc.seller,
    logo: row.logo,
    brandColor: row.licensePack ? row.brandColor : null,
    customer: doc.customer,
    sellerName: null,
    lines: items.map((i) => ({ name: i.name, unit: i.unit, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
    subtotal: doc.subtotal,
    discount: doc.discount,
    deliveryFee: doc.deliveryFee,
    total: doc.total,
    vatRate: doc.vatRate,
    payment:
      kind === "facture" && row.sale?.id
        ? { paid: Math.min(row.sale.amountPaid, doc.total), method: row.sale.paymentMethod, cancelled: row.sale.status === "cancelled" || row.sale.status === "returned" }
        : null,
    note: doc.note,
    footer: doc.footer,
  };
}

/** Les employés à code PIN ont un nom normal ; seule l'adresse technique ne doit jamais apparaître. */
function isTechnicalName(name: string | null) {
  return !name || name.includes("@employes.sama-stock.invalid");
}

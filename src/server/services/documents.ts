import "server-only";
import { and, eq, like, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { businesses, documents, type DocumentParty } from "@/db/schema";
import { signDocumentToken, type SignedDocKind, verifyDocumentToken } from "@/lib/domain/document-token";
import { dakarYear, documentNumber, documentPrefix, type DocumentType } from "@/lib/domain/documents";
import { SITE_URL } from "@/lib/seo";
import type { BusinessContext } from "../context";

/**
 * Numéro suivant (DEV-2026-0001, FAC-2026-0001), sans trou ni doublon : la ligne du commerce est verrouillée le
 * temps de la transaction, et l'index unique (commerce, numéro) reste le dernier garde-fou.
 */
export async function nextDocumentNumber(tx: Tx, businessId: string, type: DocumentType, now = new Date()): Promise<string> {
  await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).for("update");
  const year = dakarYear(now);
  const [row] = await tx
    .select({ last: sql<number | null>`max(substring(${documents.number} from '[0-9]+$')::int)` })
    .from(documents)
    .where(and(eq(documents.businessId, businessId), like(documents.number, `${documentPrefix(type, year)}%`)));
  return documentNumber(type, year, Number(row?.last ?? 0) + 1);
}

/** Une vente ou commande annulée annule aussi sa facture (dans la même transaction). */
export async function cancelInvoicesOfSale(tx: Tx, saleId: string) {
  await tx
    .update(documents)
    .set({ status: "annulee", cancelledAt: new Date() })
    .where(and(eq(documents.saleId, saleId), eq(documents.type, "facture"), eq(documents.status, "emise")));
}

/** Le vendeur tel qu'il sera imprimé : recopié pour que le document ne change plus si la boutique déménage. */
export function sellerSnapshot(business: BusinessContext["business"]): DocumentParty {
  return {
    name: business.name,
    phone: business.phone,
    address: business.address,
    city: business.city,
    ninea: business.ninea,
    rccm: business.rccm,
  };
}

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET manquant");
  return value;
}

export function documentToken(kind: SignedDocKind, id: string): string {
  return signDocumentToken(secret(), kind, id);
}

export function readDocumentToken(token: string) {
  return verifyDocumentToken(secret(), token);
}

/** Page publique d'authenticité (QR code, lien envoyé au client). */
export function verifyUrl(kind: SignedDocKind, id: string): string {
  return `${SITE_URL}/verifier/${documentToken(kind, id)}`;
}

/** Chemin du PDF, relatif au site (même lien pour la boutique et pour son client). */
export function pdfPath(kind: SignedDocKind, id: string): string {
  return `/verifier/${documentToken(kind, id)}/pdf`;
}

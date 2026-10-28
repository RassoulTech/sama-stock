import "server-only";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import journal from "../../../drizzle/meta/_journal.json";
import {
  adminAuditLog, businessNotes, categories, customerPayments, customers, documentItems, documents, invitations, licensePayments,
  licenseSales, locations, members, products, purchaseItems, purchases, saleItems, sales, shopDevices, stockLevels, stockMovements,
  suppliers, user,
} from "@/db/schema";

/** Tables d'une boutique, dans l'ordre d'insertion (les tables mères d'abord ; on efface dans l'ordre inverse). */
export const SHOP_TABLES = {
  locations, categories, suppliers, customers, products, stockLevels, purchases, purchaseItems, sales, saleItems,
  customerPayments, stockMovements, documents, documentItems, members, shopDevices, invitations,
} as const;
export type ShopTableName = keyof typeof SHOP_TABLES;

/** Tables filles sans `business_id` : lues et effacées par leur table mère. */
export const CHILD_TABLES = {
  purchaseItems: { parent: purchases, parentKey: "purchases", fk: purchaseItems.purchaseId },
  saleItems: { parent: sales, parentKey: "sales", fk: saleItems.saleId },
  documentItems: { parent: documents, parentKey: "documents", fk: documentItems.documentId },
} as const;

export const ADMIN_TABLES = { licenseSales, licensePayments, businessNotes, adminAuditLog } as const;
export type AdminTableName = keyof typeof ADMIN_TABLES;

/** Ce que gère l'admin dans la ligne du commerce : gardé tel quel quand on restaure une boutique. */
export const ADMIN_MANAGED_BUSINESS_KEYS = [
  "plan", "trialEndsAt", "periodEndsAt", "suspendedAt", "isDemo", "demoResetAt", "licensePack", "licenseActivatedAt",
  "maintenanceEndsAt", "slug", "brandColor",
] as const;

/** Colonnes date (les fichiers les gardent en texte ISO). */
export function dateKeys(table: PgTable): string[] {
  return Object.entries(getTableColumns(table))
    .filter(([, c]) => c.dataType === "date")
    .map(([k]) => k);
}

/** Colonnes qui désignent un utilisateur (clé étrangère vers `user`), trouvées dans le schéma lui-même. */
export function userRefKeys(table: PgTable): string[] {
  const byDbName = new Map(Object.entries(getTableColumns(table)).map(([k, c]) => [c.name, k]));
  return getTableConfig(table).foreignKeys.flatMap((fk) => {
    const ref = fk.reference();
    return ref.foreignTable === user ? ref.columns.map((c) => byDbName.get(c.name)!).filter(Boolean) : [];
  });
}

export function reviveRow(row: Record<string, unknown>, dates: string[]): Record<string, unknown> {
  const out = { ...row };
  for (const k of dates) if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
  return out;
}

/** Dernière migration connue du code (« 0012_pannes »). */
export function currentMigration(): string {
  return journal.entries.at(-1)?.tag ?? "inconnue";
}

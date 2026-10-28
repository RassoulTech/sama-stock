import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { account, businesses, user } from "@/db/schema";
import { BACKUP_FORMAT, countRows, sortRows, type BackupPayload } from "@/lib/backup/format";
import { adminEmails } from "../admin-emails";
import { ADMIN_TABLES, CHILD_TABLES, currentMigration, SHOP_TABLES, type ShopTableName } from "./tables";

type Rows = Record<string, unknown>[];

/** Comptes de connexion sans les jetons Google (inutiles et sensibles). */
async function accountsOf(userIds: string[]): Promise<Rows> {
  if (userIds.length === 0) return [];
  const rows = await db.select().from(account).where(inArray(account.userId, userIds));
  return rows.map((a) => ({ ...a, accessToken: null, refreshToken: null, idToken: null }));
}

async function shopTables(businessId: string): Promise<Record<ShopTableName, Rows>> {
  const out = {} as Record<ShopTableName, Rows>;
  for (const [name, table] of Object.entries(SHOP_TABLES) as [ShopTableName, PgTable & { businessId?: unknown }][]) {
    const child = CHILD_TABLES[name as keyof typeof CHILD_TABLES];
    if (child) {
      const rows = await db
        .select({ row: table })
        .from(table)
        .innerJoin(child.parent, eq(child.parent.id, child.fk))
        .where(eq(child.parent.businessId, businessId));
      out[name] = rows.map((r) => r.row as Record<string, unknown>);
    } else {
      // Toutes les tables non filles ont business_id
      const t = table as unknown as typeof SHOP_TABLES.locations;
      out[name] = (await db.select().from(t).where(eq(t.businessId, businessId))) as Rows;
    }
  }
  return out;
}

/** Tout le contenu d'une boutique (sans ce qui ne doit jamais être copié). */
export async function exportShop(businessId: string): Promise<BackupPayload> {
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!business) throw new Error("Commerce introuvable.");
  const tables = await shopTables(businessId);
  const userIds = [...new Set([...(tables.members as { userId: string }[]).map((m) => m.userId), ...(business.ownerId ? [business.ownerId] : [])])];
  const users = userIds.length ? ((await db.select().from(user).where(inArray(user.id, userIds))) as Rows) : [];
  const all: Record<string, Rows> = { businesses: [business as Record<string, unknown>], ...tables, users, accounts: await accountsOf(userIds) };
  const sorted = Object.fromEntries(Object.entries(all).map(([k, rows]) => [k, sortRows(rows)]));
  return {
    format: BACKUP_FORMAT,
    type: "boutique",
    createdAt: new Date().toISOString(),
    migration: currentMigration(),
    businessId,
    name: business.name,
    counts: countRows(sorted),
    tables: sorted,
  };
}

/** Données de l'espace admin : licences, paiements, notes, journal, comptes des super admins. */
export async function exportAdmin(): Promise<BackupPayload> {
  const tables: Record<string, Rows> = {};
  for (const [name, table] of Object.entries(ADMIN_TABLES)) tables[name] = (await db.select().from(table as PgTable)) as Rows;
  const emails = adminEmails();
  const admins = emails.length ? ((await db.select().from(user).where(inArray(user.email, emails))) as Rows) : [];
  tables.users = admins;
  tables.accounts = await accountsOf(admins.map((u) => u.id as string));
  tables.shops = (await db
    .select({ id: businesses.id, name: businesses.name, slug: businesses.slug, licensePack: businesses.licensePack })
    .from(businesses)
    .where(eq(businesses.isDemo, false))) as Rows;
  const sorted = Object.fromEntries(Object.entries(tables).map(([k, rows]) => [k, sortRows(rows)]));
  return {
    format: BACKUP_FORMAT,
    type: "admin",
    createdAt: new Date().toISOString(),
    migration: currentMigration(),
    businessId: null,
    name: "Espace admin",
    counts: countRows(sorted),
    tables: sorted,
  };
}

/** Nombre de lignes actuelles d'une boutique (pour la fenêtre « ce qui sera perdu »). */
export async function currentShopCounts(businessId: string): Promise<Record<string, number>> {
  return countRows(await shopTables(businessId));
}

export async function listBackupBusinessIds(): Promise<string[]> {
  const rows = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.isDemo, false)));
  return rows.map((r) => r.id);
}

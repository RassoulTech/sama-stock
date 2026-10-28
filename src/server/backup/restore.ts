import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, type Tx } from "@/db";
import { account, businesses, sales, user } from "@/db/schema";
import { migrationNumber, type BackupPayload } from "@/lib/backup/format";
import type { AppContext } from "../context";
import { logAdmin } from "../services/admin-audit";
import { ADMIN_MANAGED_BUSINESS_KEYS, ADMIN_TABLES, CHILD_TABLES, currentMigration, dateKeys, reviveRow, SHOP_TABLES, userRefKeys } from "./tables";

type Row = Record<string, unknown>;
const CHUNK = 400;

function assertCompatible(payload: BackupPayload) {
  if (migrationNumber(payload.migration) > migrationNumber(currentMigration())) {
    throw new Error("Cette sauvegarde vient d'une version plus récente de Sama Stock : mettez d'abord le site à jour.");
  }
}

async function insertRows(tx: Tx, table: PgTable, rows: Row[], knownUsers: Set<string>) {
  if (rows.length === 0) return;
  const dates = dateKeys(table);
  const userKeys = userRefKeys(table);
  const prepared = rows.map((r) => {
    const row = reviveRow(r, dates);
    for (const k of userKeys) if (typeof row[k] === "string" && !knownUsers.has(row[k] as string)) row[k] = null;
    return row;
  });
  for (let i = 0; i < prepared.length; i += CHUNK) await tx.insert(table).values(prepared.slice(i, i + CHUNK) as never);
}

/** Recrée les utilisateurs absents (et leurs comptes) ; un utilisateur existant n'est jamais modifié. */
export async function restoreUsers(tx: Tx, payload: BackupPayload): Promise<Set<string>> {
  const users = (payload.tables.users ?? []) as Row[];
  const ids = users.map((u) => u.id as string);
  const existing = ids.length ? new Set((await tx.select({ id: user.id }).from(user).where(inArray(user.id, ids))).map((u) => u.id)) : new Set<string>();
  const missing = users.filter((u) => !existing.has(u.id as string));
  if (missing.length) {
    const created = await tx
      .insert(user)
      .values(missing.map((u) => reviveRow(u, dateKeys(user))) as never)
      .onConflictDoNothing()
      .returning({ id: user.id });
    const createdIds = new Set(created.map((c) => c.id));
    const accounts = ((payload.tables.accounts ?? []) as Row[]).filter((a) => createdIds.has(a.userId as string));
    if (accounts.length) await tx.insert(account).values(accounts.map((a) => reviveRow(a, dateKeys(account))) as never).onConflictDoNothing();
  }
  const all = ids.length ? await tx.select({ id: user.id }).from(user).where(inArray(user.id, ids)) : [];
  return new Set(all.map((u) => u.id));
}

/** Remet une boutique dans l'état du fichier, sans toucher aux autres boutiques ni aux licences. */
export async function restoreShopPayload(payload: BackupPayload, ctx: AppContext): Promise<void> {
  if (payload.type !== "boutique" || !payload.businessId) throw new Error("Ce fichier n'est pas la sauvegarde d'une boutique.");
  assertCompatible(payload);
  const businessId = payload.businessId;
  const saved = payload.tables.businesses?.[0];
  if (!saved) throw new Error("Fichier incomplet : la fiche du commerce manque.");

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`sama-stock-restore:${businessId}`}))`);
    const [current] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).for("update");

    // 1. Effacer le contenu actuel : tables filles, puis les autres dans l'ordre inverse
    const names = Object.keys(SHOP_TABLES) as (keyof typeof SHOP_TABLES)[];
    for (const name of [...names].reverse()) {
      const child = CHILD_TABLES[name as keyof typeof CHILD_TABLES];
      if (child) {
        const parentIds = tx.select({ id: child.parent.id }).from(child.parent).where(eq(child.parent.businessId, businessId));
        await tx.delete(SHOP_TABLES[name]).where(inArray(child.fk, parentIds));
      } else {
        const t = SHOP_TABLES[name] as unknown as typeof SHOP_TABLES.locations;
        await tx.delete(t).where(eq(t.businessId, businessId));
      }
    }

    // 2. Utilisateurs absents recréés
    const knownUsers = await restoreUsers(tx, payload);

    // 3. Fiche du commerce : contenu de la sauvegarde, réglages de l'admin actuels, compteurs jamais en arrière
    const row = reviveRow(saved, dateKeys(businesses));
    if (typeof row.ownerId === "string" && !knownUsers.has(row.ownerId)) row.ownerId = null;
    if (current) {
      const update: Row = { ...row };
      delete update.id;
      for (const k of ADMIN_MANAGED_BUSINESS_KEYS) update[k] = current[k];
      update.saleCounter = Math.max(Number(current.saleCounter), Number(row.saleCounter ?? 0));
      update.orderCounter = Math.max(Number(current.orderCounter), Number(row.orderCounter ?? 0));
      await tx.update(businesses).set(update as never).where(eq(businesses.id, businessId));
    } else {
      await tx.insert(businesses).values(row as never);
    }

    // 4. Contenu, tables mères d'abord ; « vente corrigée » reliée après coup
    const replaces: { id: string; replacesId: string }[] = [];
    for (const name of names) {
      let rows = (payload.tables[name] ?? []) as Row[];
      if (name === "sales") {
        rows = rows.map((r) => {
          if (typeof r.replacesId === "string") replaces.push({ id: r.id as string, replacesId: r.replacesId });
          return { ...r, replacesId: null };
        });
      }
      await insertRows(tx, SHOP_TABLES[name], rows, knownUsers);
    }
    for (const r of replaces) await tx.update(sales).set({ replacesId: r.replacesId }).where(eq(sales.id, r.id));

    await logAdmin(tx, ctx, { action: "restore", businessId, summary: `Boutique « ${payload.name} » remise à l'état du ${payload.createdAt.slice(0, 10)}` });
  });
}

/** Remet licences, paiements, notes et journal dans l'état du fichier admin. */
export async function restoreAdminPayload(payload: BackupPayload, ctx: AppContext): Promise<void> {
  if (payload.type !== "admin") throw new Error("Ce fichier n'est pas la sauvegarde de l'espace admin.");
  assertCompatible(payload);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('sama-stock-restore:admin'))`);
    const knownUsers = await restoreUsers(tx, payload);
    const shops = new Set((await tx.select({ id: businesses.id }).from(businesses)).map((b) => b.id));
    const { licensePayments, licenseSales, businessNotes, adminAuditLog } = ADMIN_TABLES;
    await tx.delete(licensePayments);
    await tx.delete(licenseSales);
    await tx.delete(businessNotes);
    await tx.delete(adminAuditLog);
    const ofKnownShop = (rows: Row[]) => rows.filter((r) => shops.has(r.businessId as string));
    await insertRows(tx, licenseSales, ofKnownShop((payload.tables.licenseSales ?? []) as Row[]), knownUsers);
    await insertRows(tx, licensePayments, ofKnownShop((payload.tables.licensePayments ?? []) as Row[]), knownUsers);
    await insertRows(tx, businessNotes, ofKnownShop((payload.tables.businessNotes ?? []) as Row[]), knownUsers);
    const journal = ((payload.tables.adminAuditLog ?? []) as Row[]).map((r) => (r.businessId && !shops.has(r.businessId as string) ? { ...r, businessId: null } : r));
    await insertRows(tx, adminAuditLog, journal, knownUsers);
    await logAdmin(tx, ctx, { action: "restore", summary: `Données admin remises à l'état du ${payload.createdAt.slice(0, 10)}` });
  });
}

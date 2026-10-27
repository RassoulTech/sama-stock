"use server";

import { hashPassword } from "better-auth/crypto";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, type Tx } from "@/db";
import { account, businesses, licensePayments, licenseSales, locations, members, user } from "@/db/schema";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { BRAND_COLORS, type BrandColor } from "@/lib/domain/brand";
import { isValidSlug } from "@/lib/domain/slug";
import { addMonths, computePlanState, LICENSE_PACKS, MAINTENANCE_INCLUDED_MONTHS, type LicensePackId } from "@/lib/domain/plans";
import { ACTIVITIES, defaultModules, type Activity } from "@/lib/domain/sales";
import { formatDate, formatFCFA, normalizePhone } from "@/lib/format";
import { ActionError, parse, runAction } from "../action";
import { requireSuperAdminAction, type AppContext } from "../context";
import { logAdmin } from "../services/admin-audit";
import { setCredentialPassword, temporaryPassword } from "../services/passwords";
import { ensureBusinessSlug } from "../services/business-slug";
import { importInputSchema, importProductRows, type ImportBatchInput, type ImportBatchResult } from "../services/product-import";

const PACKS = Object.keys(LICENSE_PACKS) as [LicensePackId, ...LicensePackId[]];
const METHODS = Object.keys(LICENSE_PAYMENT_METHODS) as [LicensePaymentMethod, ...LicensePaymentMethod[]];
const COLORS = Object.keys(BRAND_COLORS) as [BrandColor, ...BrandColor[]];
const money = (max: number) => z.coerce.number({ message: "Montant invalide." }).int("Montant sans virgule.").min(0, "Montant invalide.").max(max);

const saleSchema = z.object({
  pack: z.enum(PACKS, { message: "Choisissez un forfait." }),
  price: money(100_000_000),
  maintenancePrice: money(10_000_000),
  deposit: money(100_000_000).default(0),
  method: z.enum(METHODS).default("especes"),
  note: z.string().trim().max(500).optional().default(""),
});

const phone = z
  .string()
  .trim()
  .min(1, "Le téléphone du client est nécessaire pour lui envoyer ses accès.")
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide (ex. 77 123 45 67)." });
      return z.NEVER;
    }
    return p;
  });

const clientSchema = z.object({
  businessName: z.string().trim().min(2, "Donnez le nom du commerce.").max(80),
  activity: z.enum(Object.keys(ACTIVITIES) as [Activity, ...Activity[]], { message: "Choisissez l'activité." }),
  city: z.string().trim().max(60).optional().default(""),
  phone,
  ownerName: z.string().trim().min(2, "Donnez le nom du propriétaire.").max(80),
  ownerEmail: z.string().trim().toLowerCase().email("Adresse e-mail invalide : elle sert à se connecter."),
  brandColor: z.enum(COLORS).default("vert"),
});

/** Numéro de document suivant : SS-2026-0001 (verrou pour éviter deux numéros identiques). */
async function nextSaleNumber(tx: Tx): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('sama-stock-license-number'))`);
  const year = new Date().getFullYear();
  // Le plus grand numéro de l'année (et non le nombre de ventes) : une vente supprimée ne fait jamais réutiliser un numéro
  const [row] = await tx
    .select({ n: sql<number>`coalesce(max(substring(${licenseSales.number} from '[0-9]+$')::int), 0)` })
    .from(licenseSales)
    .where(sql`${licenseSales.number} like ${`SS-${year}-%`}`);
  return `SS-${year}-${String(Number(row?.n ?? 0) + 1).padStart(4, "0")}`;
}

/** Active la licence d'un commerce et enregistre la vente (et l'acompte éventuel). */
async function activateLicense(tx: Tx, ctx: AppContext, businessId: string, sale: z.output<typeof saleSchema>) {
  const pack = LICENSE_PACKS[sale.pack];
  const now = new Date();
  const maintenanceEnd = addMonths(now, MAINTENANCE_INCLUDED_MONTHS);
  await tx
    .update(businesses)
    .set({ licensePack: sale.pack, licenseActivatedAt: now, maintenanceEndsAt: maintenanceEnd, suspendedAt: null })
    .where(eq(businesses.id, businessId));
  const number = await nextSaleNumber(tx);
  const [created] = await tx
    .insert(licenseSales)
    .values({
      number,
      businessId,
      pack: sale.pack,
      listPrice: pack.price,
      agreedPrice: sale.price,
      maintenancePrice: sale.maintenancePrice,
      note: sale.note || null,
      createdBy: ctx.user.id,
    })
    .returning({ id: licenseSales.id });
  if (sale.deposit > 0) {
    await tx.insert(licensePayments).values({
      saleId: created!.id,
      businessId,
      kind: "licence",
      amount: sale.deposit,
      method: sale.method,
      note: "Acompte",
      recordedBy: ctx.user.id,
    });
  }
  await logAdmin(tx, ctx, {
    action: "license",
    businessId,
    summary: `Licence ${pack.label} vendue ${formatFCFA(sale.price)} (${number})${sale.deposit > 0 ? `, acompte ${formatFCFA(sale.deposit)}` : ""}`,
  });
  // Adresse de la page de connexion de la boutique (…/b/son-nom), créée une seule fois
  const slug = await ensureBusinessSlug(tx, businessId);
  return { saleId: created!.id, number, slug };
}

/** Crée le compte du propriétaire avec un mot de passe provisoire (ou réutilise son compte s'il existe). */
async function ensureOwner(tx: Tx, name: string, email: string) {
  const [existing] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) return { userId: existing.id, password: null };
  const userId = crypto.randomUUID();
  const password = temporaryPassword();
  await tx.insert(user).values({ id: userId, name, email, emailVerified: true });
  await tx.insert(account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(password),
    updatedAt: new Date(),
  });
  return { userId, password };
}

/** Nouveau client : commerce, compte du propriétaire, boutique, licence et acompte, en une fois. */
export async function adminCreateLicenseClient(input: { client: z.input<typeof clientSchema>; sale: z.input<typeof saleSchema> }) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const client = parse(clientSchema, input.client);
    const sale = parse(saleSchema, input.sale);
    if (sale.deposit > sale.price) throw new ActionError("L'acompte dépasse le prix convenu.");

    const result = await db.transaction(async (tx) => {
      const owner = await ensureOwner(tx, client.ownerName, client.ownerEmail);
      const [business] = await tx
        .insert(businesses)
        .values({
          name: client.businessName,
          activity: client.activity,
          phone: client.phone,
          city: client.city || null,
          ...defaultModules(client.activity),
          plan: "trial",
          ownerId: owner.userId,
          brandColor: client.brandColor,
        })
        .returning({ id: businesses.id });
      const businessId = business!.id;
      await tx.insert(members).values({ businessId, userId: owner.userId, role: "owner" });
      await tx.insert(locations).values({
        businessId,
        name: client.activity === "ecommerce" ? "Stock principal" : "Boutique principale",
        kind: client.activity === "ecommerce" ? "depot" : "boutique",
      });
      const { saleId, number, slug } = await activateLicense(tx, ctx, businessId, sale);
      return { businessId, saleId, number, slug, password: owner.password };
    });

    revalidatePath("/admin", "layout");
    return { ...result, email: client.ownerEmail, phone: client.phone, ownerName: client.ownerName, businessName: client.businessName };
  });
}

/** Vend une licence à un commerce déjà inscrit (en essai gratuit). */
export async function adminSellLicense(businessId: string, input: z.input<typeof saleSchema>) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const sale = parse(saleSchema, input);
    if (sale.deposit > sale.price) throw new ActionError("L'acompte dépasse le prix convenu.");
    const [b] = await db.select({ id: businesses.id, licensePack: businesses.licensePack }).from(businesses).where(eq(businesses.id, businessId));
    if (!b) throw new ActionError("Commerce introuvable.");
    if (b.licensePack) throw new ActionError("Ce commerce a déjà une licence. Annulez-la d'abord pour changer de forfait.");
    const result = await db.transaction((tx) => activateLicense(tx, ctx, businessId, sale));
    revalidatePath("/admin", "layout");
    return result;
  });
}

async function loadSale(saleId: string) {
  const [s] = await db.select().from(licenseSales).where(eq(licenseSales.id, saleId));
  if (!s) throw new ActionError("Vente introuvable.");
  return s;
}

/** Argent reçu : solde de la licence, ou maintenance annuelle (prolonge la maintenance d'un an). */
export async function adminRecordLicensePayment(
  saleId: string,
  input: { kind: "licence" | "maintenance"; amount: number | string; method: string; note?: string },
) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const data = parse(
      z.object({
        kind: z.enum(["licence", "maintenance"]),
        amount: money(100_000_000).refine((v) => v > 0, "Indiquez le montant reçu."),
        method: z.enum(METHODS, { message: "Choisissez le moyen de paiement." }),
        note: z.string().trim().max(200).optional().default(""),
      }),
      input,
    );
    const sale = await loadSale(saleId);
    if (sale.status !== "active") throw new ActionError("Cette vente est annulée.");

    await db.transaction(async (tx) => {
      await tx.insert(licensePayments).values({
        saleId,
        businessId: sale.businessId,
        kind: data.kind,
        amount: data.amount,
        method: data.method,
        note: data.note || null,
        recordedBy: ctx.user.id,
      });
      if (data.kind === "maintenance") {
        const [b] = await tx.select({ end: businesses.maintenanceEndsAt }).from(businesses).where(eq(businesses.id, sale.businessId));
        const base = b?.end && b.end > new Date() ? b.end : new Date();
        const end = addMonths(base, 12);
        await tx.update(businesses).set({ maintenanceEndsAt: end }).where(eq(businesses.id, sale.businessId));
        await logAdmin(tx, ctx, {
          action: "maintenance",
          businessId: sale.businessId,
          summary: `Maintenance payée ${formatFCFA(data.amount)} (${LICENSE_PAYMENT_METHODS[data.method]}) : jusqu'au ${formatDate(end)}`,
        });
      } else {
        await logAdmin(tx, ctx, {
          action: "license_payment",
          businessId: sale.businessId,
          summary: `${formatFCFA(data.amount)} reçus pour la licence ${sale.number} (${LICENSE_PAYMENT_METHODS[data.method]})`,
        });
      }
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** Annule une vente (remboursement, erreur) : le commerce perd sa licence. */
export async function adminCancelLicenseSale(saleId: string) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const sale = await loadSale(saleId);
    if (sale.status !== "active") throw new ActionError("Cette vente est déjà annulée.");
    await db.transaction(async (tx) => {
      await tx.update(licenseSales).set({ status: "annulee", cancelledAt: new Date() }).where(eq(licenseSales.id, saleId));
      await tx.update(businesses).set({ licensePack: null, maintenanceEndsAt: null }).where(eq(businesses.id, sale.businessId));
      await logAdmin(tx, ctx, { action: "license_cancel", businessId: sale.businessId, summary: `Licence ${sale.number} annulée` });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

/** Nouveau mot de passe provisoire pour le propriétaire (à lui transmettre ; il pourra le changer). */
export async function adminResetOwnerPassword(businessId: string) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const [row] = await db
      .select({ ownerId: businesses.ownerId, email: user.email, name: user.name, licensed: sql<boolean>`${businesses.licensePack} is not null` })
      .from(businesses)
      .innerJoin(user, eq(user.id, businesses.ownerId))
      .where(eq(businesses.id, businessId));
    if (!row?.ownerId) throw new ActionError("Ce commerce n'a pas de propriétaire.");
    const password = temporaryPassword();
    await db.transaction(async (tx) => {
      await setCredentialPassword(tx, row.ownerId!, password);
      await logAdmin(tx, ctx, { action: "reset_password", businessId, targetUserId: row.ownerId, summary: `Mot de passe provisoire créé pour ${row.email}` });
    });
    const slug = row.licensed ? await ensureBusinessSlug(db, businessId) : null;
    return { email: row.email, name: row.name, password, slug };
  });
}

/** Couleur et logo de l'application du client (faits pendant l'installation). */
export async function adminUpdateBrand(businessId: string, input: { brandColor: string; logo?: string | null }) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const data = parse(
      z.object({
        brandColor: z.enum(COLORS, { message: "Couleur inconnue." }),
        logo: z
          .string()
          .max(400_000, "Logo trop lourd.")
          .refine((v) => v === "" || v.startsWith("data:image/"), "Image invalide.")
          .nullable()
          .optional(),
      }),
      input,
    );
    await db.transaction(async (tx) => {
      await tx
        .update(businesses)
        .set({ brandColor: data.brandColor, ...(data.logo !== undefined ? { logo: data.logo || null } : {}) })
        .where(eq(businesses.id, businessId));
      await logAdmin(tx, ctx, {
        action: "brand",
        businessId,
        summary: `Couleur « ${BRAND_COLORS[data.brandColor].label} »${data.logo !== undefined ? (data.logo ? ", logo ajouté" : ", logo retiré") : ""}`,
      });
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/", "layout");
    return null;
  });
}

/** Adresse de la page de connexion de la boutique : créée à partir du nom, ou choisie par l'administrateur. */
export async function adminUpdateSlug(businessId: string, input: { slug?: string }) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const wanted = (input.slug ?? "").trim().toLowerCase();
    const slug = await db.transaction(async (tx) => {
      if (!wanted) return ensureBusinessSlug(tx, businessId);
      if (!isValidSlug(wanted)) {
        throw new ActionError("Adresse invalide : 3 à 40 lettres minuscules, chiffres et tirets (ex. quincaillerie-ndiaye).");
      }
      const [other] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, wanted));
      if (other && other.id !== businessId) throw new ActionError("Cette adresse est déjà prise par une autre boutique.");
      await tx.update(businesses).set({ slug: wanted }).where(eq(businesses.id, businessId));
      await logAdmin(tx, ctx, { action: "address", businessId, summary: `Adresse de connexion : /b/${wanted}` });
      return wanted;
    });
    if (!slug) throw new ActionError("Commerce introuvable.");
    revalidatePath("/admin", "layout");
    return { slug };
  });
}

/** Import Excel des produits d'un client, fait par l'administrateur pendant l'installation. */
export async function adminImportProductsBatch(businessId: string, input: ImportBatchInput) {
  return runAction<ImportBatchResult>(async () => {
    const ctx = await requireSuperAdminAction();
    const [b] = await db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!b) throw new ActionError("Commerce introuvable.");
    const [location] = await db.select({ id: locations.id }).from(locations).where(eq(locations.businessId, businessId)).orderBy(asc(locations.createdAt)).limit(1);
    if (!location) throw new ActionError("Ce commerce n'a pas encore de boutique.");
    const plan = computePlanState(b);
    const result = await importProductRows(
      { businessId, locationId: location.id, userId: ctx.user.id, maxProducts: plan.limits.maxProducts, planLabel: plan.label, note: "Import Excel (installation)" },
      parse(importInputSchema, input),
    );
    if (result.created + result.updated > 0) {
      await logAdmin(db, ctx, {
        action: "import",
        businessId,
        summary: `${result.created} produit${result.created > 1 ? "s" : ""} créé${result.created > 1 ? "s" : ""}${result.updated ? `, ${result.updated} mis à jour` : ""}`,
      });
    }
    revalidatePath(`/admin/commerces/${businessId}`);
    return result;
  });
}

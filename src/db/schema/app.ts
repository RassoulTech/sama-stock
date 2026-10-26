import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const qty = (name: string) => numeric(name, { precision: 14, scale: 3, mode: "number" });

/** Un commerce = un client du SaaS (locataire). */
export const businesses = pgTable("businesses", {
  id: id(),
  name: text("name").notNull(),
  activity: text("activity").notNull().default("autre"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  logo: text("logo"),
  modulePos: boolean("module_pos").notNull().default(true),
  moduleOrders: boolean("module_orders").notNull().default(true),
  plan: text("plan").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  periodEndsAt: timestamp("period_ends_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  saleCounter: integer("sale_counter").notNull().default(0),
  orderCounter: integer("order_counter").notNull().default(0),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
  /** Boutique fictive de la démonstration publique (remise à zéro chaque jour). */
  isDemo: boolean("is_demo").notNull().default(false),
  demoResetAt: timestamp("demo_reset_at", { withTimezone: true }),
  /** Licence achetée (boutique | pro | business) : l'application n'expire jamais. */
  licensePack: text("license_pack"),
  licenseActivatedAt: timestamp("license_activated_at", { withTimezone: true }),
  /** Fin de la maintenance (assistance, nouveautés, sauvegardes) d'une licence. */
  maintenanceEndsAt: timestamp("maintenance_ends_at", { withTimezone: true }),
  /** Couleur de l'application personnalisée (licences), parmi les couleurs proposées. */
  brandColor: text("brand_color"),
  /** Adresse de la page de connexion de la boutique (licences) : …/b/quincaillerie-ndiaye */
  slug: text("slug").unique(),
  createdAt: createdAt(),
});

export const members = pgTable(
  "members",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    /** Code PIN à 4 chiffres (empreinte), tapé sur un appareil de la boutique pour ouvrir sa session. */
    pinHash: text("pin_hash"),
    pinFailures: integer("pin_failures").notNull().default(0),
    pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
    pinSetAt: timestamp("pin_set_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("members_business_user_uq").on(t.businessId, t.userId), index("members_user_idx").on(t.userId)],
);

/** Téléphone ou tablette activé par le propriétaire : seul endroit où les employés tapent leur code PIN. */
export const shopDevices = pgTable(
  "shop_devices",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Empreinte SHA-256 du jeton secret gardé dans le cookie de l'appareil. */
    tokenHash: text("token_hash").notNull().unique(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("shop_devices_business_idx").on(t.businessId)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    invitedById: text("invited_by_id").references(() => user.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("invitations_business_idx").on(t.businessId)],
);

/** Boutique ou dépôt d'un commerce. */
export const locations = pgTable(
  "locations",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("boutique"),
    createdAt: createdAt(),
  },
  (t) => [index("locations_business_idx").on(t.businessId)],
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("categories_business_name_uq").on(t.businessId, t.name)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    reference: text("reference"),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    unit: text("unit").notNull().default("piece"),
    /** Coût moyen pondéré, en FCFA */
    costPrice: integer("cost_price").notNull().default(0),
    salePrice: integer("sale_price").notNull().default(0),
    alertThreshold: qty("alert_threshold").notNull().default(0),
    /** Photo compressée (data URL webp/jpeg) */
    imageData: text("image_data"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("products_business_idx").on(t.businessId)],
);

/** Quantité physique d'un produit dans une boutique / un dépôt. */
export const stockLevels = pgTable(
  "stock_levels",
  {
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    quantity: qty("quantity").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.locationId] }),
    index("stock_levels_location_idx").on(t.locationId),
    // Valeur du stock d'un commerce (tableau de bord) sans relire tout le stock de la plateforme
    index("stock_levels_business_idx").on(t.businessId),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    /** Positive = entrée, négative = sortie */
    quantity: qty("quantity").notNull(),
    reason: text("reason"),
    refType: text("ref_type"),
    refId: text("ref_id"),
    /** Coût unitaire au moment du mouvement (pour valoriser les pertes) */
    unitCost: integer("unit_cost"),
    note: text("note"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("stock_movements_business_created_idx").on(t.businessId, t.createdAt),
    index("stock_movements_product_idx").on(t.productId),
  ],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("suppliers_business_idx").on(t.businessId)],
);

export const purchases = pgTable(
  "purchases",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    total: integer("total").notNull().default(0),
    note: text("note"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("purchases_business_idx").on(t.businessId, t.createdAt)],
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: id(),
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: qty("quantity").notNull(),
    unitCost: integer("unit_cost"),
  },
  (t) => [index("purchase_items_purchase_idx").on(t.purchaseId), index("purchase_items_product_idx").on(t.productId)],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    address: text("address"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("customers_business_idx").on(t.businessId)],
);

/** Vente en boutique (kind = sale) ou commande en ligne (kind = order). */
export const sales = pgTable(
  "sales",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    kind: text("kind").notNull(),
    channel: text("channel").notNull().default("boutique"),
    /** sale : completed | cancelled — order : new | preparing | shipping | delivered | cancelled | returned */
    status: text("status").notNull(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    total: integer("total").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    paymentMethod: text("payment_method"),
    deliveryAddress: text("delivery_address"),
    note: text("note"),
    createdAt: createdAt(),
    /** Date de prise en compte dans le chiffre d'affaires (vente validée / commande livrée) */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    /** Identifiant créé par le téléphone : empêche d'enregistrer deux fois la même vente. */
    clientRef: text("client_ref"),
    /** Rempli quand la vente a été faite sans internet, puis envoyée plus tard. */
    offlineSyncedAt: timestamp("offline_synced_at", { withTimezone: true }),
    /** Points à vérifier relevés à l'envoi (stock négatif, prix différent…). */
    syncFlags: text("sync_flags").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [
    uniqueIndex("sales_business_number_uq").on(t.businessId, t.number),
    index("sales_business_created_idx").on(t.businessId, t.createdAt),
    index("sales_business_completed_idx").on(t.businessId, t.completedAt),
    index("sales_customer_idx").on(t.customerId),
    uniqueIndex("sales_business_client_ref_uq").on(t.businessId, t.clientRef).where(sql`${t.clientRef} is not null`),
    // Commandes qui réservent du stock : relues à chaque ouverture de la caisse, sans parcourir tout l'historique
    index("sales_reserving_orders_idx")
      .on(t.businessId, t.locationId)
      .where(sql`${t.kind} = 'order' and ${t.status} in ('new', 'preparing')`),
    // Ventes rattachées à un client : crédits et historique client sans parcourir toutes les ventes
    index("sales_business_customer_idx").on(t.businessId, t.customerId).where(sql`${t.customerId} is not null`),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: id(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    quantity: qty("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    /** Coût d'achat au moment de la vente, pour un bénéfice exact */
    unitCost: integer("unit_cost").notNull().default(0),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId), index("sale_items_product_idx").on(t.productId)],
);

/** Remboursement d'une dette client. */
export const customerPayments = pgTable(
  "customer_payments",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    method: text("method").notNull(),
    note: text("note"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("customer_payments_customer_idx").on(t.customerId),
    index("customer_payments_business_created_idx").on(t.businessId, t.createdAt),
  ],
);

export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    amount: integer("amount").notNull().default(0),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    method: text("method").notNull(),
    note: text("note"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("subscription_events_business_idx").on(t.businessId)],
);

/** Paiement d'abonnement en ligne (SasPay : Wave, Orange Money), activé seulement une fois confirmé par SasPay. */
export const subscriptionCheckouts = pgTable(
  "subscription_checkouts",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    /** Prix de la formule, payé par le client (frais compris). */
    amount: integer("amount").notNull(),
    /** Montant de base demandé à SasPay (prix moins les frais quand SasPay les ajoute au client). */
    requestedAmount: integer("requested_amount"),
    sessionId: text("session_id").notNull(),
    status: text("status").notNull().default("pending"), // pending | paid | failed
    transactionId: text("transaction_id"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("subscription_checkouts_session_idx").on(t.sessionId),
    index("subscription_checkouts_business_idx").on(t.businessId),
  ],
);

/** Journal des actions des administrateurs de la plateforme (qui a fait quoi, et quand). */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: id(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    /** Type d'action : plan, extend, expire, cash, suspend, resume, revoke_session, revoke_user, note */
    action: text("action").notNull(),
    businessId: text("business_id").references(() => businesses.id, { onDelete: "set null" }),
    targetUserId: text("target_user_id"),
    /** Phrase lisible : « Formule Pro activée pour 30 jours ». */
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt), index("admin_audit_log_business_idx").on(t.businessId)],
);

/** Notes internes des administrateurs sur un commerce (jamais visibles par le commerçant). */
export const businessNotes = pgTable(
  "business_notes",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("business_notes_business_idx").on(t.businessId)],
);

/** Vente d'une licence à un commerce (prix négocié, payable en plusieurs fois). */
export const licenseSales = pgTable(
  "license_sales",
  {
    id: id(),
    /** Numéro de document : SS-2026-0001. */
    number: text("number").notNull(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    pack: text("pack").notNull(),
    /** Prix catalogue au moment de la vente. */
    listPrice: integer("list_price").notNull(),
    /** Prix convenu avec le client. */
    agreedPrice: integer("agreed_price").notNull(),
    /** Maintenance annuelle convenue (après la première année). */
    maintenancePrice: integer("maintenance_price").notNull(),
    status: text("status").notNull().default("active"), // active | annulee
    note: text("note"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("license_sales_number_idx").on(t.number), index("license_sales_business_idx").on(t.businessId)],
);

/** Argent reçu pour une licence (acompte, solde) ou pour sa maintenance annuelle. */
export const licensePayments = pgTable(
  "license_payments",
  {
    id: id(),
    saleId: text("sale_id")
      .notNull()
      .references(() => licenseSales.id, { onDelete: "cascade" }),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // licence | maintenance
    amount: integer("amount").notNull(),
    method: text("method").notNull(), // wave | orange_money | especes | virement | autre
    note: text("note"),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("license_payments_sale_idx").on(t.saleId), index("license_payments_business_idx").on(t.businessId)],
);

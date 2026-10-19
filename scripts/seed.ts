/**
 * Données de démonstration Sama Stock.
 *   npm run db:seed          → crée les comptes de démo s'ils n'existent pas
 *   npm run db:seed -- --force → supprime puis recrée les données de démo
 */
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray, like, or } from "drizzle-orm";
import { db } from "../src/db";
import {
  account,
  businesses,
  categories,
  customerPayments,
  customers,
  locations,
  members,
  products,
  purchaseItems,
  purchases,
  saleItems,
  sales,
  stockLevels,
  stockMovements,
  subscriptionEvents,
  suppliers,
  user,
} from "../src/db/schema";

const PASSWORD = "samastock2026";
const DAY = 86_400_000;
const NOW = Date.now();

// Générateur pseudo-aléatoire reproductible
let seed = 20261019;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const id = () => crypto.randomUUID();
/** Date il y a `daysAgo` jours, à une heure d'ouverture (Dakar = UTC). */
const at = (daysAgo: number, hour = int(8, 20), minute = int(0, 59)) => {
  const d = new Date(NOW - daysAgo * DAY);
  d.setUTCHours(hour, minute, int(0, 59), 0);
  return d.getTime() > NOW ? new Date(NOW - int(5, 90) * 60_000) : d;
};

const DEMO_USERS = [
  { key: "awa", name: "Awa Diop", email: "awa@demo.sn" },
  { key: "fatou", name: "Fatou Sow", email: "fatou@demo.sn" },
  { key: "moussa", name: "Moussa Fall", email: "moussa@demo.sn" },
  { key: "ibrahima", name: "Ibrahima Ndiaye", email: "ibrahima@demo.sn" },
  { key: "ndiaye", name: "Mamadou Ndiaye", email: "ndiaye@demo.sn" },
  { key: "admin", name: "Admin Sama Stock", email: "admin@samastock.sn" },
] as const;

type Row<T extends { $inferInsert: unknown }> = T["$inferInsert"];

async function insertChunks<T>(insert: (rows: T[]) => Promise<unknown>, rows: T[], size = 400) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

async function cleanup() {
  const emails = DEMO_USERS.map((u) => u.email);
  // Comptes de démonstration + comptes créés pendant les tests sur le domaine fictif @demo.sn
  const users = await db
    .select({ id: user.id })
    .from(user)
    .where(or(inArray(user.email, emails), like(user.email, "%@demo.sn")));
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await db.delete(businesses).where(inArray(businesses.ownerId, ids));
    await db.delete(user).where(inArray(user.id, ids));
  }
}

// ── Simulation d'un commerce ─────────────────────────────────────────────────

interface ProductSpec {
  name: string;
  cat: string;
  unit: string;
  cost: number;
  price: number;
  threshold: number;
  /** stock initial par boutique (index de boutique) */
  initial: number[];
  /** popularité relative */
  weight: number;
}

interface Sim {
  businessId: string;
  ownerId: string;
  sellers: string[];
  locationIds: string[];
  products: (ProductSpec & { id: string })[];
  stock: Map<string, number>; // `${productId}:${locationId}`
  movements: Row<typeof stockMovements>[];
  sales: Row<typeof sales>[];
  items: Row<typeof saleItems>[];
  saleCounter: number;
  orderCounter: number;
}

const key = (p: string, l: string) => `${p}:${l}`;

function move(sim: Sim, productId: string, locationId: string, quantity: number, type: string, createdAt: Date, extra: Partial<Row<typeof stockMovements>> = {}) {
  sim.stock.set(key(productId, locationId), (sim.stock.get(key(productId, locationId)) ?? 0) + quantity);
  const product = sim.products.find((p) => p.id === productId)!;
  sim.movements.push({
    id: id(),
    businessId: sim.businessId,
    locationId,
    productId,
    type,
    quantity,
    unitCost: product.cost,
    userId: extra.userId ?? sim.ownerId,
    createdAt,
    ...extra,
  });
}

function reserved(sim: Sim, productId: string, locationId: string) {
  const open = new Set(sim.sales.filter((s) => s.kind === "order" && (s.status === "new" || s.status === "preparing") && s.locationId === locationId).map((s) => s.id));
  return sim.items.filter((i) => open.has(i.saleId) && i.productId === productId).reduce((s, i) => s + Number(i.quantity), 0);
}

function pickLines(sim: Sim, locationId: string, maxLines: number) {
  const lines: { product: Sim["products"][number]; qty: number }[] = [];
  const count = int(1, maxLines);
  for (let n = 0; n < count * 3 && lines.length < count; n++) {
    const total = sim.products.reduce((s, p) => s + p.weight, 0);
    let r = rand() * total;
    const product = sim.products.find((p) => (r -= p.weight) <= 0) ?? sim.products[0]!;
    if (lines.some((l) => l.product.id === product.id)) continue;
    const available = (sim.stock.get(key(product.id, locationId)) ?? 0) - reserved(sim, product.id, locationId);
    const qty = Math.min(available, product.unit === "m" || product.unit === "kg" ? int(2, 12) : int(1, 3));
    if (qty > 0) lines.push({ product, qty });
  }
  return lines;
}

function addSale(
  sim: Sim,
  opts: {
    kind: "sale" | "order";
    locationId: string;
    createdAt: Date;
    channel: string;
    status: string;
    customerId: string | null;
    userId: string;
    method: string | null;
    paidRatio: number;
    deliveryFee?: number;
    address?: string | null;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
    maxLines?: number;
  },
) {
  const lines = pickLines(sim, opts.locationId, opts.maxLines ?? 3);
  if (lines.length === 0) return null;
  const saleId = id();
  const subtotal = lines.reduce((s, l) => s + Math.round(l.qty * l.product.price), 0);
  const deliveryFee = opts.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;
  const amountPaid = Math.round((total * opts.paidRatio) / 500) * 500;
  const number =
    opts.kind === "sale" ? `V-${String(++sim.saleCounter).padStart(4, "0")}` : `C-${String(++sim.orderCounter).padStart(4, "0")}`;

  sim.sales.push({
    id: saleId,
    businessId: sim.businessId,
    locationId: opts.locationId,
    number,
    kind: opts.kind,
    channel: opts.channel,
    status: opts.status,
    customerId: opts.customerId,
    userId: opts.userId,
    subtotal,
    discount: 0,
    deliveryFee,
    total,
    amountPaid: Math.min(total, amountPaid),
    paymentMethod: opts.paidRatio > 0 ? opts.method : opts.kind === "sale" ? "credit" : null,
    deliveryAddress: opts.address ?? null,
    createdAt: opts.createdAt,
    completedAt: opts.completedAt ?? null,
    cancelledAt: opts.cancelledAt ?? null,
    updatedAt: opts.completedAt ?? opts.createdAt,
  });
  for (const l of lines) {
    sim.items.push({
      id: id(),
      saleId,
      productId: l.product.id,
      name: l.product.name,
      unit: l.product.unit,
      quantity: l.qty,
      unitPrice: l.product.price,
      unitCost: l.product.cost,
      lineTotal: Math.round(l.qty * l.product.price),
    });
  }
  return { saleId, lines };
}

async function persist(sim: Sim, extra: { purchases: Row<typeof purchases>[]; purchaseItems: Row<typeof purchaseItems>[]; payments: Row<typeof customerPayments>[] }) {
  await insertChunks((r) => db.insert(purchases).values(r), extra.purchases);
  await insertChunks((r) => db.insert(purchaseItems).values(r), extra.purchaseItems);
  await insertChunks((r) => db.insert(sales).values(r), sim.sales);
  await insertChunks((r) => db.insert(saleItems).values(r), sim.items);
  await insertChunks((r) => db.insert(stockMovements).values(r), sim.movements);
  await insertChunks((r) => db.insert(customerPayments).values(r), extra.payments);
  const levels = [...sim.stock.entries()].map(([k, quantity]) => {
    const [productId, locationId] = k.split(":");
    return { businessId: sim.businessId, productId: productId!, locationId: locationId!, quantity };
  });
  await insertChunks((r) => db.insert(stockLevels).values(r), levels);
  await db
    .update(businesses)
    .set({ saleCounter: sim.saleCounter, orderCounter: sim.orderCounter })
    .where(eq(businesses.id, sim.businessId));
}

/** Rembourse une partie des dettes (imputation sur les ventes les plus anciennes). */
function repayments(sim: Sim, customerIds: string[], ratio: number) {
  const payments: Row<typeof customerPayments>[] = [];
  for (const customerId of customerIds) {
    const unpaid = sim.sales
      .filter((s) => s.customerId === customerId && s.total! > s.amountPaid! && (s.status === "completed" || s.status === "delivered"))
      .sort((a, b) => +a.completedAt! - +b.completedAt!);
    const debt = unpaid.reduce((s, x) => s + x.total! - x.amountPaid!, 0);
    let amount = Math.round((debt * ratio) / 500) * 500;
    if (amount <= 0) continue;
    const last = unpaid[unpaid.length - 1]!;
    payments.push({
      id: id(),
      businessId: sim.businessId,
      customerId,
      amount,
      method: pick(["cash", "wave", "orange_money"]),
      userId: sim.ownerId,
      createdAt: new Date(Math.min(NOW - 3600_000, +last.completedAt! + 2 * DAY)),
    });
    for (const s of unpaid) {
      if (amount <= 0) break;
      const part = Math.min(amount, s.total! - s.amountPaid!);
      s.amountPaid = s.amountPaid! + part;
      amount -= part;
    }
  }
  return payments;
}

// ── Commerce 1 : Awa Mode & Beauté (Business, 2 boutiques, caisse + commandes) ──

const AWA_PRODUCTS: ProductSpec[] = [
  { name: "Robe wax longue", cat: "Vêtements", unit: "piece", cost: 9000, price: 15000, threshold: 5, initial: [18, 30], weight: 9 },
  { name: "Boubou brodé homme", cat: "Vêtements", unit: "piece", cost: 18000, price: 28000, threshold: 3, initial: [8, 10], weight: 4 },
  { name: "Ensemble pagne tissé", cat: "Vêtements", unit: "piece", cost: 12000, price: 19500, threshold: 4, initial: [6, 8], weight: 5 },
  { name: "Chemise bazin riche", cat: "Vêtements", unit: "piece", cost: 7500, price: 12500, threshold: 5, initial: [14, 12], weight: 6 },
  { name: "T-shirt coton imprimé", cat: "Vêtements", unit: "piece", cost: 2500, price: 5000, threshold: 10, initial: [70, 60], weight: 10 },
  { name: "Sandales cuir artisanales", cat: "Chaussures", unit: "paire", cost: 6000, price: 10000, threshold: 4, initial: [12, 10], weight: 6 },
  { name: "Babouches brodées", cat: "Chaussures", unit: "paire", cost: 4500, price: 8000, threshold: 4, initial: [5, 0], weight: 5 },
  { name: "Baskets toile", cat: "Chaussures", unit: "paire", cost: 9500, price: 15000, threshold: 3, initial: [14, 6], weight: 4 },
  { name: "Sac à main simili cuir", cat: "Accessoires", unit: "piece", cost: 8000, price: 14000, threshold: 3, initial: [9, 5], weight: 5 },
  { name: "Foulard soie", cat: "Accessoires", unit: "piece", cost: 2500, price: 5000, threshold: 6, initial: [40, 20], weight: 7 },
  { name: "Parure bijoux dorés", cat: "Accessoires", unit: "piece", cost: 3500, price: 7500, threshold: 4, initial: [15, 0], weight: 5 },
  { name: "Lunettes de soleil", cat: "Accessoires", unit: "piece", cost: 2000, price: 4500, threshold: 5, initial: [20, 10], weight: 4 },
  { name: "Beurre de karité 250 g", cat: "Cosmétiques", unit: "piece", cost: 1500, price: 3000, threshold: 10, initial: [70, 50], weight: 9 },
  { name: "Savon noir naturel", cat: "Cosmétiques", unit: "piece", cost: 800, price: 1500, threshold: 12, initial: [90, 60], weight: 10 },
  { name: "Huile de coco 500 ml", cat: "Cosmétiques", unit: "bouteille", cost: 2000, price: 3500, threshold: 8, initial: [9, 24], weight: 7 },
  { name: "Parfum oriental 50 ml", cat: "Cosmétiques", unit: "bouteille", cost: 6000, price: 12000, threshold: 3, initial: [14, 6], weight: 4 },
  { name: "Lait de corps hydratant", cat: "Cosmétiques", unit: "bouteille", cost: 2500, price: 4500, threshold: 6, initial: [16, 12], weight: 5 },
  { name: "Encens thiouraye", cat: "Cosmétiques", unit: "sachet", cost: 1000, price: 2500, threshold: 10, initial: [50, 40], weight: 8 },
  { name: "Mèches brésiliennes", cat: "Mèches et perruques", unit: "paquet", cost: 7000, price: 12000, threshold: 4, initial: [3, 0], weight: 6 },
  { name: "Perruque lisse 40 cm", cat: "Mèches et perruques", unit: "piece", cost: 22000, price: 35000, threshold: 2, initial: [4, 3], weight: 2 },
];

const AWA_CUSTOMERS = [
  ["Fatou Diop", "771234567", "Parcelles Assainies U17"],
  ["Aminata Ba", "776543210", "Médina, rue 22"],
  ["Mariama Sy", "781112233", "Liberté 6"],
  ["Khady Faye", "705556677", "Grand Yoff"],
  ["Ndèye Sarr", "774445566", "Sicap Baobab"],
  ["Coumba Diallo", "767778899", "Pikine Icotaf"],
  ["Rokhaya Mbaye", "772223344", "Ouakam"],
  ["Astou Gueye", "783334455", "Point E"],
  ["Seynabou Kane", "709990011", "Guédiawaye"],
  ["Adama Thiam", "778889900", "Yoff Virage"],
  ["Binta Camara", "766665544", "HLM 5"],
  ["Ousmane Diagne", "775554433", "Keur Massar"],
  ["Aïssatou Ndiaye", "784443322", "Mermoz"],
  ["Penda Sall", "701239876", "Rufisque"],
] as const;

// ── Commerce 2 : Quincaillerie (essai, caisse seule) ─────────────────────────

const QUINCAILLERIE_PRODUCTS: ProductSpec[] = [
  { name: "Ciment 50 kg", cat: "Gros œuvre", unit: "sac", cost: 4200, price: 4600, threshold: 20, initial: [60], weight: 10 },
  { name: "Fer à béton 10 mm (barre)", cat: "Gros œuvre", unit: "piece", cost: 3600, price: 4200, threshold: 15, initial: [80], weight: 7 },
  { name: "Fer à béton 8 mm (barre)", cat: "Gros œuvre", unit: "piece", cost: 2400, price: 2900, threshold: 15, initial: [70], weight: 6 },
  { name: "Tôle ondulée 2 m", cat: "Gros œuvre", unit: "piece", cost: 4500, price: 5500, threshold: 10, initial: [30], weight: 3 },
  { name: "Clous de 8", cat: "Quincaillerie", unit: "kg", cost: 900, price: 1300, threshold: 5, initial: [25], weight: 5 },
  { name: "Fil de fer recuit", cat: "Quincaillerie", unit: "kg", cost: 1100, price: 1500, threshold: 5, initial: [8], weight: 4 },
  { name: "Cadenas laiton 40 mm", cat: "Quincaillerie", unit: "piece", cost: 1800, price: 3000, threshold: 5, initial: [20], weight: 3 },
  { name: "Peinture à eau blanche 20 L", cat: "Peinture", unit: "piece", cost: 17000, price: 21000, threshold: 4, initial: [10], weight: 3 },
  { name: "Peinture à huile 4 L", cat: "Peinture", unit: "piece", cost: 9000, price: 12000, threshold: 4, initial: [3], weight: 2 },
  { name: "Rouleau à peinture", cat: "Peinture", unit: "piece", cost: 1200, price: 2000, threshold: 6, initial: [18], weight: 3 },
  { name: "Câble électrique 2,5 mm²", cat: "Électricité", unit: "m", cost: 350, price: 500, threshold: 50, initial: [300], weight: 6 },
  { name: "Ampoule LED 12 W", cat: "Électricité", unit: "piece", cost: 900, price: 1500, threshold: 10, initial: [40], weight: 4 },
  { name: "Interrupteur simple", cat: "Électricité", unit: "piece", cost: 600, price: 1000, threshold: 10, initial: [35], weight: 3 },
  { name: "Tuyau PVC 32 (barre 4 m)", cat: "Plomberie", unit: "piece", cost: 2800, price: 3500, threshold: 8, initial: [25], weight: 4 },
  { name: "Robinet laiton 1/2", cat: "Plomberie", unit: "piece", cost: 3000, price: 4500, threshold: 5, initial: [12], weight: 3 },
  { name: "Colle PVC 250 ml", cat: "Plomberie", unit: "piece", cost: 1500, price: 2500, threshold: 5, initial: [4], weight: 3 },
  { name: "Brouette renforcée", cat: "Outillage", unit: "piece", cost: 22000, price: 28000, threshold: 2, initial: [5], weight: 1 },
  { name: "Pelle ronde", cat: "Outillage", unit: "piece", cost: 2500, price: 3500, threshold: 4, initial: [12], weight: 2 },
];

const QUINCAILLERIE_CUSTOMERS = [
  ["Modou Seck (maçon)", "771010101", "Thiès Nord"],
  ["Entreprise BTP Diallo", "338221122", "Thiès, route de Dakar"],
  ["Cheikh Gaye (électricien)", "776060606", "Thiès, Cité Lamy"],
  ["Abdou Faye", "709080706", "Mbour"],
  ["Pape Ndour (plombier)", "785051525", "Thiès Est"],
  ["Alioune Diouf", "772020202", "Tivaouane"],
] as const;

async function createBusiness(opts: {
  name: string;
  activity: string;
  phone: string;
  address: string;
  city: string;
  ownerId: string;
  plan: string;
  createdDaysAgo: number;
  trialEndsAt: Date;
  periodEndsAt: Date | null;
  modulePos: boolean;
  moduleOrders: boolean;
  locationNames: { name: string; kind: string }[];
  productSpecs: ProductSpec[];
  customerSpecs: readonly (readonly [string, string, string])[];
}) {
  const businessId = id();
  const createdAt = new Date(NOW - opts.createdDaysAgo * DAY);
  await db.insert(businesses).values({
    id: businessId,
    name: opts.name,
    activity: opts.activity,
    phone: opts.phone,
    address: opts.address,
    city: opts.city,
    modulePos: opts.modulePos,
    moduleOrders: opts.moduleOrders,
    plan: opts.plan,
    trialEndsAt: opts.trialEndsAt,
    periodEndsAt: opts.periodEndsAt,
    ownerId: opts.ownerId,
    createdAt,
  });
  const locationIds = opts.locationNames.map(() => id());
  await db.insert(locations).values(
    opts.locationNames.map((l, i) => ({ id: locationIds[i]!, businessId, name: l.name, kind: l.kind, createdAt: new Date(+createdAt + i * 1000) })),
  );
  const catIds = new Map<string, string>();
  for (const c of [...new Set(opts.productSpecs.map((p) => p.cat))]) catIds.set(c, id());
  await db.insert(categories).values([...catIds].map(([name, cid]) => ({ id: cid, businessId, name })));

  const productsWithIds = opts.productSpecs.map((p) => ({ ...p, id: id() }));
  await db.insert(products).values(
    productsWithIds.map((p) => ({
      id: p.id,
      businessId,
      name: p.name,
      unit: p.unit,
      categoryId: catIds.get(p.cat)!,
      costPrice: p.cost,
      salePrice: p.price,
      alertThreshold: p.threshold,
      createdAt,
      updatedAt: createdAt,
    })),
  );
  const customerIds = opts.customerSpecs.map(() => id());
  await db.insert(customers).values(
    opts.customerSpecs.map(([name, phone, address], i) => ({
      id: customerIds[i]!,
      businessId,
      name,
      phone: `+221${phone}`,
      address,
      createdAt: new Date(+createdAt + int(1, 10) * DAY),
    })),
  );

  const sim: Sim = {
    businessId,
    ownerId: opts.ownerId,
    sellers: [opts.ownerId],
    locationIds,
    products: productsWithIds,
    stock: new Map(),
    movements: [],
    sales: [],
    items: [],
    saleCounter: 0,
    orderCounter: 0,
  };
  for (const p of productsWithIds) {
    p.initial.forEach((qty, li) => {
      if (qty > 0) move(sim, p.id, locationIds[li]!, qty, "initial", new Date(+createdAt + 3600_000));
      else sim.stock.set(key(p.id, locationIds[li]!), 0);
    });
  }
  return { businessId, sim, customerIds, locationIds, productsWithIds };
}

async function main() {
  const force = process.argv.includes("--force");
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, "awa@demo.sn"));
  if (existing && !force) {
    console.log("Les données de démonstration existent déjà. (Pour les recréer : npm run db:seed -- --force)");
    return;
  }
  console.log("Préparation des données de démonstration…");
  await cleanup();

  // Comptes
  const hash = await hashPassword(PASSWORD);
  const userIds: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const uid = id();
    userIds[u.key] = uid;
    await db.insert(user).values({ id: uid, name: u.name, email: u.email, emailVerified: true, createdAt: new Date(NOW - 40 * DAY) });
    await db.insert(account).values({ id: id(), accountId: uid, providerId: "credential", userId: uid, password: hash, updatedAt: new Date() });
  }

  // ── Awa ──
  const awa = await createBusiness({
    name: "Awa Mode & Beauté",
    activity: "boutique",
    phone: "+221771234500",
    address: "Avenue Blaise Diagne, Médina",
    city: "Dakar",
    ownerId: userIds.awa!,
    plan: "business",
    createdDaysAgo: 40,
    trialEndsAt: new Date(NOW - 26 * DAY),
    periodEndsAt: new Date(NOW + 25 * DAY),
    modulePos: true,
    moduleOrders: true,
    locationNames: [
      { name: "Boutique Médina", kind: "boutique" },
      { name: "Dépôt Liberté 6", kind: "depot" },
    ],
    productSpecs: AWA_PRODUCTS,
    customerSpecs: AWA_CUSTOMERS,
  });
  await db.insert(members).values([
    { businessId: awa.businessId, userId: userIds.awa!, role: "owner", createdAt: new Date(NOW - 40 * DAY) },
    { businessId: awa.businessId, userId: userIds.fatou!, role: "manager", createdAt: new Date(NOW - 30 * DAY) },
    { businessId: awa.businessId, userId: userIds.moussa!, role: "seller", createdAt: new Date(NOW - 28 * DAY) },
    { businessId: awa.businessId, userId: userIds.ibrahima!, role: "storekeeper", createdAt: new Date(NOW - 28 * DAY) },
  ]);
  awa.sim.sellers = [userIds.awa!, userIds.moussa!, userIds.moussa!, userIds.fatou!];
  await db.insert(subscriptionEvents).values([
    { businessId: awa.businessId, plan: "business", amount: 11500, periodStart: new Date(NOW - 26 * DAY), periodEnd: new Date(NOW - 4 * DAY + 0), method: "simulation", userId: userIds.awa!, createdAt: new Date(NOW - 26 * DAY) },
    { businessId: awa.businessId, plan: "business", amount: 11500, periodStart: new Date(NOW - 5 * DAY), periodEnd: new Date(NOW + 25 * DAY), method: "simulation", userId: userIds.awa!, createdAt: new Date(NOW - 5 * DAY) },
  ]);

  const [medina, depot] = awa.locationIds as [string, string];
  const supplierRows = [
    { id: id(), businessId: awa.businessId, name: "Grossiste Sandaga", phone: "+221776001122", note: "Tissus et prêt-à-porter. Paiement à 15 jours." },
    { id: id(), businessId: awa.businessId, name: "Karité du Sine", phone: "+221775003344", note: "Cosmétiques naturels, livraison le jeudi." },
    { id: id(), businessId: awa.businessId, name: "Import Dubaï Fashion", phone: "+221781005566", note: "Mèches, parfums, accessoires." },
  ];
  await db.insert(suppliers).values(supplierRows);

  const awaPurchases: Row<typeof purchases>[] = [];
  const awaPurchaseItems: Row<typeof purchaseItems>[] = [];
  function purchase(sim: Sim, supplierId: string | null, locationId: string, daysAgo: number, lines: [string, number][]) {
    const pid = id();
    const createdAt = at(daysAgo, 9);
    let total = 0;
    for (const [name, qty] of lines) {
      const p = sim.products.find((x) => x.name === name)!;
      total += qty * p.cost;
      awaPurchaseItems.push({ id: id(), purchaseId: pid, productId: p.id, quantity: qty, unitCost: p.cost });
      move(sim, p.id, locationId, qty, "purchase", createdAt, { refType: "purchase", refId: pid });
    }
    awaPurchases.push({ id: pid, businessId: sim.businessId, locationId, supplierId, total, userId: sim.ownerId, createdAt });
  }

  const awaChannels = ["whatsapp", "whatsapp", "whatsapp", "instagram", "instagram", "tiktok", "facebook", "telephone"];
  for (let d = 34; d >= 0; d--) {
    if (d === 25) purchase(awa.sim, supplierRows[0]!.id, medina, d, [["Robe wax longue", 12], ["T-shirt coton imprimé", 30], ["Chemise bazin riche", 8]]);
    if (d === 18) purchase(awa.sim, supplierRows[1]!.id, medina, d, [["Beurre de karité 250 g", 30], ["Savon noir naturel", 40], ["Lait de corps hydratant", 10]]);
    if (d === 12) {
      // Transfert du dépôt vers la boutique
      const tid = id();
      for (const [name, qty] of [["Robe wax longue", 10], ["Foulard soie", 8]] as const) {
        const p = awa.sim.products.find((x) => x.name === name)!;
        const when = at(d, 10);
        move(awa.sim, p.id, depot, -qty, "transfer_out", when, { refType: "transfer", refId: tid, userId: userIds.ibrahima! });
        move(awa.sim, p.id, medina, qty, "transfer_in", when, { refType: "transfer", refId: tid, userId: userIds.ibrahima! });
      }
    }
    if (d === 9) purchase(awa.sim, supplierRows[2]!.id, medina, d, [["Parfum oriental 50 ml", 6], ["Perruque lisse 40 cm", 2]]);
    if (d === 20) purchase(awa.sim, supplierRows[0]!.id, medina, d, [["Robe wax longue", 10], ["Sandales cuir artisanales", 8]]);

    // Réassort hebdomadaire, comme le ferait la commerçante (les mèches restent en rupture)
    if ([28, 21, 14, 7, 3].includes(d)) {
      const bySupplier = new Map<string, [string, number][]>();
      for (const p of awa.sim.products) {
        if (p.name === "Mèches brésiliennes") continue;
        const target = Math.max(p.initial[0]!, p.threshold * 4);
        const current = awa.sim.stock.get(key(p.id, medina)) ?? 0;
        if (current >= target * 0.6) continue;
        const supplier =
          p.cat === "Cosmétiques" ? supplierRows[1]! : p.cat === "Vêtements" || p.cat === "Chaussures" ? supplierRows[0]! : supplierRows[2]!;
        const list = bySupplier.get(supplier.id) ?? [];
        list.push([p.name, target - current]);
        bySupplier.set(supplier.id, list);
      }
      for (const [supplierId, lines] of bySupplier) purchase(awa.sim, supplierId, medina, d, lines);
    }

    // Pertes et écart d'inventaire (seulement si le produit est en rayon)
    const losses: Record<number, [string, string, number, string, string, string | null]> = {
      15: ["Parfum oriental 50 ml", medina, 1, "adjust", "breakage", "Flacon tombé du présentoir"],
      8: ["Foulard soie", medina, 2, "adjust", "theft", "Constaté à la fermeture"],
      6: ["Savon noir naturel", medina, 3, "inventory", "inventory", null],
      4: ["Lait de corps hydratant", depot, 2, "adjust", "expired", null],
    };
    const loss = losses[d];
    if (loss) {
      const [name, loc, qty, type, reason, note] = loss;
      const p = awa.sim.products.find((x) => x.name === name)!;
      if ((awa.sim.stock.get(key(p.id, loc)) ?? 0) >= qty) {
        move(awa.sim, p.id, loc, -qty, type, at(d, 19), { reason, note, userId: userIds.ibrahima! });
      }
    }

    // Ventes en boutique
    const salesToday = d === 0 ? int(4, 6) : int(3, 8);
    const saleTimes = Array.from({ length: salesToday }, () => at(d)).sort((a, b) => +a - +b);
    for (const createdAt of saleTimes) {
      const credit = rand() < 0.12;
      const customerId = credit || rand() < 0.35 ? pick(awa.customerIds) : null;
      const sellerId = pick(awa.sim.sellers);
      const res = addSale(awa.sim, {
        kind: "sale",
        locationId: medina,
        createdAt,
        channel: "boutique",
        status: "completed",
        customerId,
        userId: sellerId,
        method: pick(["cash", "cash", "wave", "wave", "orange_money", "orange_money"]),
        paidRatio: credit ? pick([0, 0.5]) : 1,
        completedAt: createdAt,
      });
      res?.lines.forEach((l) =>
        move(awa.sim, l.product.id, medina, -l.qty, "sale", createdAt, { refType: "sale", refId: res.saleId, userId: sellerId }),
      );
    }

    // Commandes en ligne
    const orderTimes = Array.from({ length: int(0, 3) }, () => at(d)).sort((a, b) => +a - +b);
    for (const createdAt of orderTimes) {
      let status: string;
      if (d >= 3) status = rand() < 0.86 ? "delivered" : rand() < 0.5 ? "cancelled" : "returned";
      else if (d >= 1) status = pick(["shipping", "delivered", "preparing"]);
      else status = pick(["new", "new", "preparing"]);
      const deliveredAt = new Date(Math.min(NOW - 600_000, +createdAt + int(4, 30) * 3600_000));
      const prepaid = rand() < 0.3;
      const customerIdx = int(0, awa.customerIds.length - 1);
      const res = addSale(awa.sim, {
        kind: "order",
        locationId: medina,
        createdAt,
        channel: pick(awaChannels),
        status,
        customerId: awa.customerIds[customerIdx]!,
        userId: pick([userIds.awa!, userIds.moussa!]),
        method: pick(["wave", "orange_money", "cash"]),
        paidRatio: status === "delivered" ? (rand() < 0.85 ? 1 : 0.5) : prepaid ? 0.5 : 0,
        deliveryFee: pick([1000, 1500, 2000, 2500]),
        address: AWA_CUSTOMERS[customerIdx]![2],
        completedAt: status === "delivered" ? deliveredAt : null,
        cancelledAt: status === "cancelled" || status === "returned" ? deliveredAt : null,
        maxLines: 2,
      });
      if (!res) continue;
      if (["shipping", "delivered", "returned"].includes(status)) {
        const outAt = new Date(+createdAt + 2 * 3600_000);
        res.lines.forEach((l) => move(awa.sim, l.product.id, medina, -l.qty, "order_out", outAt, { refType: "order", refId: res.saleId }));
      }
      if (status === "returned") {
        res.lines.forEach((l) => move(awa.sim, l.product.id, medina, l.qty, "order_return", deliveredAt, { refType: "order", refId: res.saleId }));
      }
    }
  }

  const awaPayments = repayments(awa.sim, awa.customerIds.slice(0, 6), 0.6);
  await persist(awa.sim, { purchases: awaPurchases, purchaseItems: awaPurchaseItems, payments: awaPayments });

  // ── Quincaillerie Ndiaye & Fils ──
  const q = await createBusiness({
    name: "Quincaillerie Ndiaye & Fils",
    activity: "quincaillerie",
    phone: "+221339510000",
    address: "Marché central",
    city: "Thiès",
    ownerId: userIds.ndiaye!,
    plan: "trial",
    createdDaysAgo: 5,
    trialEndsAt: new Date(NOW + 9 * DAY),
    periodEndsAt: null,
    modulePos: true,
    moduleOrders: false,
    locationNames: [{ name: "Boutique principale", kind: "boutique" }],
    productSpecs: QUINCAILLERIE_PRODUCTS,
    customerSpecs: QUINCAILLERIE_CUSTOMERS,
  });
  await db.insert(members).values({ businessId: q.businessId, userId: userIds.ndiaye!, role: "owner", createdAt: new Date(NOW - 5 * DAY) });
  const [qLoc] = q.locationIds as [string];
  for (let d = 4; d >= 0; d--) {
    const times = Array.from({ length: int(3, 7) }, () => at(d)).sort((a, b) => +a - +b);
    for (const createdAt of times) {
      const credit = rand() < 0.2;
      const res = addSale(q.sim, {
        kind: "sale",
        locationId: qLoc,
        createdAt,
        channel: "boutique",
        status: "completed",
        customerId: credit || rand() < 0.4 ? pick(q.customerIds) : null,
        userId: userIds.ndiaye!,
        method: pick(["cash", "cash", "wave", "orange_money"]),
        paidRatio: credit ? 0 : 1,
        completedAt: createdAt,
        maxLines: 3,
      });
      res?.lines.forEach((l) => move(q.sim, l.product.id, qLoc, -l.qty, "sale", createdAt, { refType: "sale", refId: res.saleId }));
    }
  }
  await persist(q.sim, { purchases: [], purchaseItems: [], payments: [] });

  console.log("\nDonnées de démonstration prêtes. Mot de passe de tous les comptes :", PASSWORD);
  console.log("  awa@demo.sn         Propriétaire · Awa Mode & Beauté (Business, 2 boutiques)");
  console.log("  fatou@demo.sn       Gérante");
  console.log("  moussa@demo.sn      Vendeur");
  console.log("  ibrahima@demo.sn    Magasinier");
  console.log("  ndiaye@demo.sn      Propriétaire · Quincaillerie Ndiaye & Fils (essai, 18 produits)");
  console.log("  admin@samastock.sn  Super-administrateur");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

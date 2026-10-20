import "server-only";
import { eq } from "drizzle-orm";
import type { db } from "@/db";
import {
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
  suppliers,
} from "@/db/schema";
import type { DemoProduct, DemoSpec } from "./specs";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Row<T extends { $inferInsert: unknown }> = T["$inferInsert"];

const DAY = 86_400_000;

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function rng(seedText: string) {
  let seed = 0;
  for (const c of seedText) seed = (Math.imul(31, seed) + c.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function insertChunks<T>(insert: (rows: T[]) => Promise<unknown>, rows: T[], size = 400) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

/**
 * Crée une boutique de démonstration complète (catalogue, clients, équipe, historique d'activité)
 * dans la transaction donnée. Renvoie l'identifiant du commerce.
 */
export async function seedDemoBusiness(tx: Tx, spec: DemoSpec, ownerId: string, teamIds: Record<string, string>) {
  const NOW = Date.now();
  const rand = rng(`${spec.plan}:${new Date(NOW).toISOString().slice(0, 10)}`);
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const uid = () => crypto.randomUUID();
  /** Il y a `daysAgo` jours, à une heure d'ouverture (Dakar = UTC), jamais dans le futur. */
  const at = (daysAgo: number, hour = int(8, 20), minute = int(0, 59)) => {
    const d = new Date(NOW - daysAgo * DAY);
    d.setUTCHours(hour, minute, int(0, 59), 0);
    return d.getTime() > NOW ? new Date(NOW - int(5, 90) * 60_000) : d;
  };

  // ── Commerce, boutiques, catégories, produits, clients, fournisseurs ──
  const businessId = uid();
  const createdAt = new Date(NOW - spec.createdDaysAgo * DAY);
  await tx.insert(businesses).values({
    id: businessId,
    ...spec.business,
    plan: spec.plan,
    trialEndsAt: spec.plan === "trial" ? new Date(NOW + (14 - spec.createdDaysAgo) * DAY) : new Date(+createdAt + 14 * DAY),
    periodEndsAt: spec.plan === "trial" ? null : new Date(NOW + 20 * DAY),
    ownerId,
    isDemo: true,
    demoResetAt: new Date(NOW),
    createdAt,
  });

  const locationIds = spec.locations.map(() => uid());
  await tx
    .insert(locations)
    .values(spec.locations.map((l, i) => ({ id: locationIds[i]!, businessId, name: l.name, kind: l.kind, createdAt: new Date(+createdAt + i * 1000) })));
  const main = locationIds[0]!;
  const depot = locationIds[1];

  const catIds = new Map<string, string>();
  for (const c of new Set(spec.products.map((p) => p.cat))) catIds.set(c, uid());
  await tx.insert(categories).values([...catIds].map(([name, id]) => ({ id, businessId, name, createdAt })));

  const items = spec.products.map((p) => ({ ...p, id: uid() }));
  await tx.insert(products).values(
    items.map((p) => ({
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

  const customerIds = spec.customers.map(() => uid());
  await tx.insert(customers).values(
    spec.customers.map(([name, phone, address], i) => ({
      id: customerIds[i]!,
      businessId,
      name,
      phone: `+221${phone}`,
      address,
      createdAt: new Date(Math.min(NOW - DAY, +createdAt + int(0, 3) * DAY)),
    })),
  );

  const supplierRows = spec.suppliers.map((s) => ({ id: uid(), businessId, name: s.name, phone: s.phone, note: s.note, cats: s.cats }));
  if (supplierRows.length > 0) {
    await tx
      .insert(suppliers)
      .values(supplierRows.map((s) => ({ id: s.id, businessId, name: s.name, phone: s.phone, note: s.note, createdAt })));
  }

  await tx.insert(members).values([
    { businessId, userId: ownerId, role: "owner", createdAt },
    ...spec.team.map((m, i) => ({ businessId, userId: teamIds[m.key]!, role: m.role, createdAt: new Date(+createdAt + (i + 1) * 2 * DAY) })),
  ]);

  // ── Simulation de l'activité ──
  const sellerIds = [ownerId, ...spec.team.filter((m) => m.role !== "storekeeper").map((m) => teamIds[m.key]!)];
  const keeperId = spec.team.find((m) => m.role === "storekeeper") ? teamIds[spec.team.find((m) => m.role === "storekeeper")!.key]! : ownerId;
  const stock = new Map<string, number>();
  const key = (p: string, l: string) => `${p}:${l}`;
  const movements: Row<typeof stockMovements>[] = [];
  const saleRows: Row<typeof sales>[] = [];
  const saleItemRows: Row<typeof saleItems>[] = [];
  const purchaseRows: Row<typeof purchases>[] = [];
  const purchaseItemRows: Row<typeof purchaseItems>[] = [];
  let saleCounter = 0;
  let orderCounter = 0;

  const move = (product: DemoProduct & { id: string }, locationId: string, quantity: number, type: string, when: Date, extra: Partial<Row<typeof stockMovements>> = {}) => {
    stock.set(key(product.id, locationId), (stock.get(key(product.id, locationId)) ?? 0) + quantity);
    movements.push({ id: uid(), businessId, locationId, productId: product.id, type, quantity, unitCost: product.cost, userId: ownerId, createdAt: when, ...extra });
  };

  const reserved = (productId: string, locationId: string) => {
    const open = new Set(saleRows.filter((s) => s.kind === "order" && (s.status === "new" || s.status === "preparing") && s.locationId === locationId).map((s) => s.id));
    return saleItemRows.filter((i) => open.has(i.saleId) && i.productId === productId).reduce((s, i) => s + Number(i.quantity), 0);
  };

  const pickLines = (locationId: string, maxLines: number) => {
    const lines: { product: (typeof items)[number]; qty: number }[] = [];
    const count = int(1, maxLines);
    const totalWeight = items.reduce((s, p) => s + p.weight, 0);
    for (let n = 0; n < count * 3 && lines.length < count; n++) {
      let r = rand() * totalWeight;
      const product = items.find((p) => (r -= p.weight) <= 0) ?? items[0]!;
      if (lines.some((l) => l.product.id === product.id)) continue;
      const available = (stock.get(key(product.id, locationId)) ?? 0) - reserved(product.id, locationId);
      const qty = Math.min(available, product.unit === "m" || product.unit === "kg" ? int(2, 12) : int(1, 3));
      if (qty > 0) lines.push({ product, qty });
    }
    return lines;
  };

  const addSale = (o: {
    kind: "sale" | "order";
    createdAt: Date;
    channel: string;
    status: string;
    customerId: string | null;
    userId: string;
    method: string;
    paidRatio: number;
    deliveryFee?: number;
    address?: string | null;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
    maxLines?: number;
  }) => {
    const lines = pickLines(main, o.maxLines ?? 3);
    if (lines.length === 0) return null;
    const saleId = uid();
    const subtotal = lines.reduce((s, l) => s + Math.round(l.qty * l.product.price), 0);
    const total = subtotal + (o.deliveryFee ?? 0);
    const amountPaid = Math.min(total, Math.round((total * o.paidRatio) / 500) * 500);
    saleRows.push({
      id: saleId,
      businessId,
      locationId: main,
      number: o.kind === "sale" ? `V-${String(++saleCounter).padStart(4, "0")}` : `C-${String(++orderCounter).padStart(4, "0")}`,
      kind: o.kind,
      channel: o.channel,
      status: o.status,
      customerId: o.customerId,
      userId: o.userId,
      subtotal,
      discount: 0,
      deliveryFee: o.deliveryFee ?? 0,
      total,
      amountPaid,
      paymentMethod: o.paidRatio > 0 ? o.method : o.kind === "sale" ? "credit" : null,
      deliveryAddress: o.address ?? null,
      createdAt: o.createdAt,
      completedAt: o.completedAt ?? null,
      cancelledAt: o.cancelledAt ?? null,
      updatedAt: o.completedAt ?? o.createdAt,
    });
    for (const l of lines) {
      saleItemRows.push({
        id: uid(),
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
  };

  const purchase = (supplierId: string | null, locationId: string, daysAgo: number, lines: [(typeof items)[number], number][]) => {
    const purchaseId = uid();
    const when = at(daysAgo, 9);
    let total = 0;
    for (const [p, qty] of lines) {
      total += qty * p.cost;
      purchaseItemRows.push({ id: uid(), purchaseId, productId: p.id, quantity: qty, unitCost: p.cost });
      move(p, locationId, qty, "purchase", when, { refType: "purchase", refId: purchaseId, userId: keeperId });
    }
    purchaseRows.push({ id: purchaseId, businessId, locationId, supplierId, total, userId: keeperId, createdAt: when });
  };

  // Stock de départ
  for (const p of items) {
    p.initial.forEach((qty, li) => {
      const loc = locationIds[li];
      if (!loc) return;
      if (qty > 0) move(p, loc, qty, "initial", new Date(+createdAt + 3600_000));
      else stock.set(key(p.id, loc), 0);
    });
  }

  const supplierFor = (cat: string) => supplierRows.find((s) => s.cats.includes(cat))?.id ?? supplierRows[0]?.id ?? null;
  const H = spec.historyDays;

  for (let d = H; d >= 0; d--) {
    // Réassort hebdomadaire de la boutique principale (certains produits restent volontairement bas)
    if (d > 0 && d % 7 === 3) {
      const bySupplier = new Map<string | null, [(typeof items)[number], number][]>();
      for (const p of items) {
        if (p.noRestock) continue;
        const target = Math.max(p.initial[0]!, p.threshold * 4);
        const current = stock.get(key(p.id, main)) ?? 0;
        if (current >= target * 0.6) continue;
        const sid = supplierFor(p.cat);
        bySupplier.set(sid, [...(bySupplier.get(sid) ?? []), [p, Math.ceil(target - current)]]);
      }
      for (const [sid, lines] of bySupplier) purchase(sid, main, d, lines);
    }

    // Transfert du dépôt vers la boutique
    if (depot && d > 0 && d % 12 === 5) {
      const transferId = uid();
      const when = at(d, 10);
      for (const p of items) {
        const inDepot = stock.get(key(p.id, depot)) ?? 0;
        const inShop = stock.get(key(p.id, main)) ?? 0;
        if (inDepot >= 6 && inShop < p.threshold * 3) {
          const qty = Math.min(inDepot, p.threshold * 2);
          move(p, depot, -qty, "transfer_out", when, { refType: "transfer", refId: transferId, userId: keeperId });
          move(p, main, qty, "transfer_in", when, { refType: "transfer", refId: transferId, userId: keeperId });
        }
      }
    }

    // Pertes et écarts d'inventaire
    for (const loss of spec.losses.filter((l) => l.day === d)) {
      const p = items.find((x) => x.name === loss.product);
      const loc = loss.depot && depot ? depot : main;
      if (p && (stock.get(key(p.id, loc)) ?? 0) >= loss.qty) {
        move(p, loc, -loss.qty, loss.type, at(d, 19), { reason: loss.reason, note: loss.note, userId: keeperId });
      }
    }

    // Ventes en boutique
    if (spec.business.modulePos) {
      const n = d === 0 ? Math.max(2, Math.ceil(int(...spec.salesPerDay) / 2)) : int(...spec.salesPerDay);
      const times = Array.from({ length: n }, () => at(d)).sort((a, b) => +a - +b);
      for (const when of times) {
        const credit = rand() < spec.creditRate;
        const sellerId = pick(sellerIds);
        const res = addSale({
          kind: "sale",
          createdAt: when,
          channel: "boutique",
          status: "completed",
          customerId: credit || rand() < 0.35 ? pick(customerIds) : null,
          userId: sellerId,
          method: pick(["cash", "cash", "wave", "wave", "orange_money", "orange_money"]),
          paidRatio: credit ? pick([0, 0.5]) : 1,
          completedAt: when,
        });
        res?.lines.forEach((l) => move(l.product, main, -l.qty, "sale", when, { refType: "sale", refId: res.saleId, userId: sellerId }));
      }
    }

    // Commandes en ligne
    if (spec.business.moduleOrders) {
      const times = Array.from({ length: int(...spec.ordersPerDay) }, () => at(d)).sort((a, b) => +a - +b);
      for (const when of times) {
        let status: string;
        if (d >= 3) status = rand() < 0.86 ? "delivered" : rand() < 0.5 ? "cancelled" : "returned";
        else if (d >= 1) status = pick(["shipping", "delivered", "preparing"]);
        else status = pick(["new", "new", "preparing"]);
        const doneAt = new Date(Math.min(NOW - 600_000, +when + int(4, 30) * 3600_000));
        const ci = int(0, customerIds.length - 1);
        const res = addSale({
          kind: "order",
          createdAt: when,
          channel: pick(spec.orderChannels),
          status,
          customerId: customerIds[ci]!,
          userId: pick(sellerIds),
          method: pick(["wave", "wave", "orange_money", "cash"]),
          paidRatio: status === "delivered" ? (rand() < 0.85 ? 1 : 0.5) : rand() < 0.3 ? 0.5 : 0,
          deliveryFee: pick([1000, 1500, 2000, 2500]),
          address: spec.customers[ci]![2],
          completedAt: status === "delivered" ? doneAt : null,
          cancelledAt: status === "cancelled" || status === "returned" ? doneAt : null,
          maxLines: 2,
        });
        if (!res) continue;
        if (["shipping", "delivered", "returned"].includes(status)) {
          const outAt = new Date(+when + 2 * 3600_000);
          res.lines.forEach((l) => move(l.product, main, -l.qty, "order_out", outAt, { refType: "order", refId: res.saleId }));
        }
        if (status === "returned") {
          res.lines.forEach((l) => move(l.product, main, l.qty, "order_return", doneAt, { refType: "order", refId: res.saleId }));
        }
      }
    }
  }

  // Remboursements : la plupart des clients ont réglé, quelques-uns restent à relancer
  const payments: Row<typeof customerPayments>[] = [];
  for (const [index, customerId] of customerIds.entries()) {
    if (index < 3) continue;
    const ratio = index < 5 ? 0.6 : 1;
    const unpaid = saleRows
      .filter((s) => s.customerId === customerId && s.total! > s.amountPaid! && (s.status === "completed" || s.status === "delivered"))
      .sort((a, b) => +a.completedAt! - +b.completedAt!);
    const debt = unpaid.reduce((s, x) => s + x.total! - x.amountPaid!, 0);
    let amount = ratio === 1 ? debt : Math.round((debt * ratio) / 500) * 500;
    if (amount <= 0) continue;
    const last = unpaid[unpaid.length - 1]!;
    payments.push({
      id: uid(),
      businessId,
      customerId,
      amount,
      method: pick(["cash", "wave", "orange_money"]),
      userId: ownerId,
      createdAt: new Date(Math.min(NOW - 3600_000, +last.completedAt! + 2 * DAY)),
    });
    for (const s of unpaid) {
      if (amount <= 0) break;
      const part = Math.min(amount, s.total! - s.amountPaid!);
      s.amountPaid = s.amountPaid! + part;
      amount -= part;
    }
  }

  await insertChunks((r) => tx.insert(purchases).values(r), purchaseRows);
  await insertChunks((r) => tx.insert(purchaseItems).values(r), purchaseItemRows);
  await insertChunks((r) => tx.insert(sales).values(r), saleRows);
  await insertChunks((r) => tx.insert(saleItems).values(r), saleItemRows);
  await insertChunks((r) => tx.insert(stockMovements).values(r), movements);
  await insertChunks((r) => tx.insert(customerPayments).values(r), payments);
  const levels = [...stock.entries()].map(([k, quantity]) => {
    const [productId, locationId] = k.split(":") as [string, string];
    return { businessId, productId, locationId, quantity };
  });
  await insertChunks((r) => tx.insert(stockLevels).values(r), levels);
  await tx.update(businesses).set({ saleCounter, orderCounter }).where(eq(businesses.id, businessId));

  return businessId;
}

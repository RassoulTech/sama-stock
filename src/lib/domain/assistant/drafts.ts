/**
 * Brouillons de l'assistant : les arguments donnés par l'IA deviennent une charge exacte pour l'action existante.
 * Rien n'est enregistré ici. L'action revérifie tout (droits, stock, prix) quand le commerçant appuie sur Valider.
 */
import { z } from "zod";
import { ORDER_CHANNELS, PAYING_METHODS, SALE_METHODS, type SaleMethod } from "@/lib/domain/sales";
import { nextStatuses, ORDER_ACTION_LABELS, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain/orders";
import { EXIT_REASONS, LOSS_REASONS } from "@/lib/domain/stock";
import type { UnitId } from "@/lib/format";
import { findByName, normalizeName, type MatchResult } from "./match";
import { STATUS_TARGETS, STOCK_REASON_KEYS, UNIT_IDS, type DraftToolName } from "./tools";
import { lineTotal } from "./money";

export type PayingMethod = (typeof PAYING_METHODS)[number];
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export interface CatalogProduct {
  id: string;
  name: string;
  unit: string;
  salePrice: number;
  costPrice: number | null;
  available: number;
}
export interface CatalogParty {
  id: string;
  name: string;
  phone: string | null;
}

export interface CatalogCustomer extends CatalogParty {
  /** Ce que le client doit encore (ventes à crédit), quand il est connu. */
  debt?: number;
}
export interface CatalogOrder {
  id: string;
  number: string;
  customerName: string;
  status: OrderStatus;
}
export interface DraftCatalog {
  products: CatalogProduct[];
  customers: CatalogCustomer[];
  suppliers: CatalogParty[];
  categories?: { id: string; name: string }[];
  openOrders?: CatalogOrder[];
}

const STOCK_REASONS = { ...LOSS_REASONS, ...EXIT_REASONS };
export type StockReason = keyof typeof STOCK_REASONS;

export interface DraftLine {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  available: number;
  /** Quantité au-dessus du disponible (l'action décidera). */
  short: boolean;
}
export interface PartyRef {
  id: string;
  name: string;
}

export interface SalePayload {
  items: { productId: string; quantity: number; unitPrice?: number }[];
  paymentMethod: SaleMethod;
  customerId: string | null;
  amountReceived: number;
}
export interface PurchasePayload {
  items: { productId: string; quantity: number; unitCost?: number }[];
  supplierId: string | null;
}
export interface OrderPayload {
  customerId: string;
  channel: OrderChannel;
  items: { productId: string; quantity: number }[];
  deliveryFee: number;
  deliveryAddress: string;
  amountPaid: number;
  paymentMethod: PayingMethod | null;
}
export interface PaymentPayload {
  customerId: string;
  amount: number;
  method: PayingMethod;
}

export type Draft =
  | { action: "sale"; lines: DraftLine[]; total: number; paymentMethod: SaleMethod; amountReceived: number; customer: PartyRef | null; payload: SalePayload }
  | { action: "purchase"; lines: DraftLine[]; total: number | null; supplier: PartyRef | null; payload: PurchasePayload }
  | { action: "order"; lines: DraftLine[]; total: number; deliveryFee: number; channel: OrderChannel; customer: PartyRef; payload: OrderPayload }
  | { action: "payment"; amount: number; method: PayingMethod; customer: PartyRef; payload: PaymentPayload }
  | { action: "stock_exit"; product: PartyRef & { unit: string; available: number }; quantity: number; kind: "loss" | "exit"; reason: StockReason; reasonLabel: string; note: string }
  | { action: "order_status"; order: { id: string; number: string; customerName: string }; from: OrderStatus; to: OrderStatus; label: string }
  | { action: "product"; name: string; unit: UnitId; salePrice: number; costPrice: number | null; category: { id: string | null; name: string } | null; initialStock: number; reference: string }
  | { action: "price"; product: PartyRef; oldSalePrice: number; salePrice: number | null; costPrice: number | null }
  | { action: "customer"; name: string; phone: string; address: string }
  | { action: "supplier"; name: string; phone: string; note: string };;

export type DraftResult = { ok: true; draft: Draft } | { ok: false; reason: string; candidates?: string[] };

/** L'IA envoie parfois null ou "" pour un champ optionnel non dit : ça compte comme absent (sinon z.coerce fait 0). */
const absent = (value: unknown) => (value === null || value === "" ? undefined : value);
const optionalArg = <S extends z.ZodType>(schema: S) => z.preprocess(absent, schema.optional());

const lineArg = z.object({
  produit: z.string().trim().min(1),
  quantite: z.coerce.number().positive().max(10_000_000),
  prix_unitaire: optionalArg(z.coerce.number().int().min(0)),
  prix_achat: optionalArg(z.coerce.number().int().min(0)),
});
const linesArg = z.array(lineArg).min(1).max(50);
const saleArgs = z.object({
  lignes: linesArg,
  paiement: z.enum(SALE_METHODS),
  client: optionalArg(z.string().trim()),
  montant_recu: optionalArg(z.coerce.number().int().min(0)),
});
const purchaseArgs = z.object({ lignes: linesArg, fournisseur: optionalArg(z.string().trim()) });
const orderArgs = z.object({
  client: z.string().trim().min(1),
  canal: z.enum(ORDER_CHANNELS),
  lignes: linesArg,
  frais_livraison: optionalArg(z.coerce.number().int().min(0)),
  adresse: optionalArg(z.string().trim().max(300)),
  montant_paye: optionalArg(z.coerce.number().int().min(0)),
  paiement: optionalArg(z.enum(PAYING_METHODS)),
});
const paymentArgs = z.object({
  client: z.string().trim().min(1),
  montant: z.coerce.number().int().positive(),
  paiement: z.enum(PAYING_METHODS),
});
const exitArgs = z.object({
  produit: z.string().trim().min(1),
  quantite: z.coerce.number().positive().max(10_000_000),
  motif: z.enum(STOCK_REASON_KEYS),
  note: optionalArg(z.string().trim().max(300)),
});
const orderStatusArgs = z.object({ commande: z.string().trim().min(1), etat: z.enum(STATUS_TARGETS) });
const productArgs = z.object({
  nom: z.string().trim().min(2).max(120),
  prix_vente: z.coerce.number().int().positive(),
  prix_achat: optionalArg(z.coerce.number().int().min(0)),
  unite: optionalArg(z.enum(UNIT_IDS)),
  categorie: optionalArg(z.string().trim().max(60)),
  stock_initial: optionalArg(z.coerce.number().min(0).max(10_000_000)),
  reference: optionalArg(z.string().trim().max(60)),
});
const priceArgs = z.object({
  produit: z.string().trim().min(1),
  prix_vente: optionalArg(z.coerce.number().int().positive()),
  prix_achat: optionalArg(z.coerce.number().int().min(0)),
});
const personArgs = z.object({
  nom: z.string().trim().min(2).max(120),
  telephone: optionalArg(z.string().trim().max(30)),
  adresse: optionalArg(z.string().trim().max(300)),
  note: optionalArg(z.string().trim().max(300)),
});

class DraftRefusal extends Error {
  constructor(
    message: string,
    readonly candidates?: string[],
  ) {
    super(message);
  }
}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new DraftRefusal(`Informations incomplètes ou invalides (${result.error.issues[0]?.path.join(".") || "demande"}).`);
  }
  return result.data;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function pick<T extends { id: string; name: string }>(match: MatchResult<T>, query: string, what: string): T {
  if (match.kind === "one") return match.item;
  if (match.kind === "many") throw new DraftRefusal(`Plusieurs ${what}s correspondent à « ${query} ».`, match.items.map((i) => i.name));
  throw new DraftRefusal(`${capitalize(what)} introuvable : « ${query} ».`);
}

const ref = (p: { id: string; name: string }): PartyRef => ({ id: p.id, name: p.name });
const sum = (lines: DraftLine[]) => lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);
type LineArg = z.infer<typeof lineArg>;

function resolveLines(args: LineArg[], products: CatalogProduct[], price: (line: LineArg, product: CatalogProduct) => number | null): DraftLine[] {
  return args.map((line) => {
    const product = pick(findByName(line.produit, products), line.produit, "produit");
    const unitPrice = price(line, product);
    return {
      productId: product.id,
      name: product.name,
      unit: product.unit,
      quantity: line.quantite,
      unitPrice,
      lineTotal: unitPrice === null ? null : lineTotal(line.quantite, unitPrice),
      available: product.available,
      short: line.quantite > product.available,
    };
  });
}

function saleDraft(args: z.infer<typeof saleArgs>, catalog: DraftCatalog): Draft {
  const lines = resolveLines(args.lignes, catalog.products, (l, p) => l.prix_unitaire ?? p.salePrice);
  const total = sum(lines);
  const customer = args.client ? ref(pick(findByName(args.client, catalog.customers), args.client, "client")) : null;
  const credit = args.paiement === "credit";
  if (credit && !customer) throw new DraftRefusal("Une vente à crédit doit être rattachée à un client : dis son nom.");
  const amountReceived = credit ? 0 : Math.min(args.montant_recu ?? total, total);
  if (amountReceived < total && !customer) throw new DraftRefusal("Un paiement partiel doit être rattaché à un client : dis son nom.");
  return {
    action: "sale",
    lines,
    total,
    paymentMethod: args.paiement,
    amountReceived,
    customer,
    payload: {
      items: args.lignes.map((l, i) => ({
        productId: lines[i].productId,
        quantity: l.quantite,
        ...(l.prix_unitaire === undefined ? {} : { unitPrice: l.prix_unitaire }),
      })),
      paymentMethod: args.paiement,
      customerId: customer?.id ?? null,
      amountReceived,
    },
  };
}

function purchaseDraft(args: z.infer<typeof purchaseArgs>, catalog: DraftCatalog, costs: boolean): Draft {
  const lines = resolveLines(args.lignes, catalog.products, (l) => (costs ? (l.prix_achat ?? null) : null)).map((l) => ({ ...l, short: false }));
  const supplier = args.fournisseur ? ref(pick(findByName(args.fournisseur, catalog.suppliers), args.fournisseur, "fournisseur")) : null;
  const priced = lines.every((l) => l.lineTotal !== null);
  return {
    action: "purchase",
    lines,
    total: costs && priced ? sum(lines) : null,
    supplier,
    payload: {
      items: args.lignes.map((l, i) => ({
        productId: lines[i].productId,
        quantity: l.quantite,
        ...(costs && l.prix_achat !== undefined ? { unitCost: l.prix_achat } : {}),
      })),
      supplierId: supplier?.id ?? null,
    },
  };
}

function orderDraft(args: z.infer<typeof orderArgs>, catalog: DraftCatalog): Draft {
  const customer = ref(pick(findByName(args.client, catalog.customers), args.client, "client"));
  const lines = resolveLines(args.lignes, catalog.products, (_, p) => p.salePrice);
  const deliveryFee = args.frais_livraison ?? 0;
  const amountPaid = args.montant_paye ?? 0;
  if (amountPaid > 0 && !args.paiement) throw new DraftRefusal("Dis comment le client a payé l'avance : espèces, Wave ou Orange Money.");
  return {
    action: "order",
    lines,
    total: sum(lines) + deliveryFee,
    deliveryFee,
    channel: args.canal,
    customer,
    payload: {
      customerId: customer.id,
      channel: args.canal,
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      deliveryFee,
      deliveryAddress: args.adresse ?? "",
      amountPaid,
      paymentMethod: amountPaid > 0 ? (args.paiement ?? null) : null,
    },
  };
}

function paymentDraft(args: z.infer<typeof paymentArgs>, catalog: DraftCatalog): Draft {
  const found = pick(findByName(args.client, catalog.customers), args.client, "client");
  if (found.debt !== undefined) {
    if (found.debt <= 0) throw new DraftRefusal(`${found.name} ne doit rien.`);
    if (args.montant > found.debt) throw new DraftRefusal(`${found.name} doit seulement ${found.debt} francs.`);
  }
  const customer = ref(found);
  return {
    action: "payment",
    amount: args.montant,
    method: args.paiement,
    customer,
    payload: { customerId: customer.id, amount: args.montant, method: args.paiement },
  };
}

function exitDraft(args: z.infer<typeof exitArgs>, catalog: DraftCatalog): Draft {
  const product = pick(findByName(args.produit, catalog.products), args.produit, "produit");
  return {
    action: "stock_exit",
    product: { id: product.id, name: product.name, unit: product.unit, available: product.available },
    quantity: args.quantite,
    kind: args.motif in LOSS_REASONS ? "loss" : "exit",
    reason: args.motif,
    reasonLabel: STOCK_REASONS[args.motif],
    note: args.note ?? "",
  };
}

function findOrder(query: string, orders: CatalogOrder[]): CatalogOrder {
  const digits = query.replace(/\D/g, "");
  if (digits) {
    const byNumber = orders.filter((o) => Number(o.number.replace(/\D/g, "")) === Number(digits));
    if (byNumber.length === 1) return byNumber[0];
  }
  const match = findByName(query, orders.map((o) => ({ ...o, name: o.customerName })));
  if (match.kind === "one") return match.item;
  if (match.kind === "many") {
    throw new DraftRefusal(`Plusieurs commandes correspondent à « ${query} » : dis le numéro.`, match.items.map((o) => `${o.number} (${o.customerName})`));
  }
  throw new DraftRefusal(`Commande en cours introuvable : « ${query} ».`);
}

function orderStatusDraft(args: z.infer<typeof orderStatusArgs>, catalog: DraftCatalog): Draft {
  const order = findOrder(args.commande, catalog.openOrders ?? []);
  if (!nextStatuses(order.status).includes(args.etat)) {
    throw new DraftRefusal(`La commande ${order.number} est « ${ORDER_STATUS_LABELS[order.status]} » : elle ne peut pas passer à « ${ORDER_STATUS_LABELS[args.etat]} ».`);
  }
  return {
    action: "order_status",
    order: { id: order.id, number: order.number, customerName: order.customerName },
    from: order.status,
    to: args.etat,
    label: ORDER_ACTION_LABELS[args.etat],
  };
}

function productDraft(args: z.infer<typeof productArgs>, catalog: DraftCatalog, costs: boolean): Draft {
  const same = catalog.products.find((p) => normalizeName(p.name) === normalizeName(args.nom));
  if (same) throw new DraftRefusal(`Le produit « ${same.name} » existe déjà.`);
  let category: { id: string | null; name: string } | null = null;
  if (args.categorie) {
    const match = findByName(args.categorie, catalog.categories ?? []);
    if (match.kind === "many") throw new DraftRefusal(`Plusieurs catégories correspondent à « ${args.categorie} ».`, match.items.map((c) => c.name));
    category = match.kind === "one" ? { id: match.item.id, name: match.item.name } : { id: null, name: args.categorie };
  }
  return {
    action: "product",
    name: args.nom,
    unit: args.unite ?? "piece",
    salePrice: args.prix_vente,
    costPrice: costs ? (args.prix_achat ?? null) : null,
    category,
    initialStock: args.stock_initial ?? 0,
    reference: args.reference ?? "",
  };
}

function priceDraft(args: z.infer<typeof priceArgs>, catalog: DraftCatalog, costs: boolean): Draft {
  const product = pick(findByName(args.produit, catalog.products), args.produit, "produit");
  const costPrice = costs ? (args.prix_achat ?? null) : null;
  if (args.prix_vente === undefined && costPrice === null) throw new DraftRefusal("Dis le nouveau prix de vente.");
  return { action: "price", product: ref(product), oldSalePrice: product.salePrice, salePrice: args.prix_vente ?? null, costPrice };
}

function customerDraft(args: z.infer<typeof personArgs>, catalog: DraftCatalog): Draft {
  const same = catalog.customers.find((c) => normalizeName(c.name) === normalizeName(args.nom));
  if (same) throw new DraftRefusal(`Le client « ${same.name} » existe déjà.`);
  return { action: "customer", name: args.nom, phone: args.telephone ?? "", address: args.adresse ?? "" };
}

function supplierDraft(args: z.infer<typeof personArgs>, catalog: DraftCatalog): Draft {
  const same = catalog.suppliers.find((s) => normalizeName(s.name) === normalizeName(args.nom));
  if (same) throw new DraftRefusal(`Le fournisseur « ${same.name} » existe déjà.`);
  return { action: "supplier", name: args.nom, phone: args.telephone ?? "", note: args.note ?? "" };
}

export function buildDraft(tool: DraftToolName, rawArgs: unknown, catalog: DraftCatalog, opts: { costs: boolean }): DraftResult {
  try {
    switch (tool) {
      case "brouillon_vente":
        return { ok: true, draft: saleDraft(parse(saleArgs, rawArgs), catalog) };
      case "brouillon_entree_stock":
        return { ok: true, draft: purchaseDraft(parse(purchaseArgs, rawArgs), catalog, opts.costs) };
      case "brouillon_commande":
        return { ok: true, draft: orderDraft(parse(orderArgs, rawArgs), catalog) };
      case "brouillon_paiement_client":
        return { ok: true, draft: paymentDraft(parse(paymentArgs, rawArgs), catalog) };
      case "brouillon_sortie_stock":
        return { ok: true, draft: exitDraft(parse(exitArgs, rawArgs), catalog) };
      case "brouillon_statut_commande":
        return { ok: true, draft: orderStatusDraft(parse(orderStatusArgs, rawArgs), catalog) };
      case "brouillon_produit":
        return { ok: true, draft: productDraft(parse(productArgs, rawArgs), catalog, opts.costs) };
      case "brouillon_prix":
        return { ok: true, draft: priceDraft(parse(priceArgs, rawArgs), catalog, opts.costs) };
      case "brouillon_client":
        return { ok: true, draft: customerDraft(parse(personArgs, rawArgs), catalog) };
      case "brouillon_fournisseur":
        return { ok: true, draft: supplierDraft(parse(personArgs, rawArgs), catalog) };
    }
  } catch (error) {
    if (error instanceof DraftRefusal) {
      return { ok: false, reason: error.message, ...(error.candidates ? { candidates: error.candidates } : {}) };
    }
    throw error;
  }
}

/** Ce que l'IA voit du brouillon : noms, quantités et montants, jamais d'identifiants. */
export function draftForModel(draft: Draft): Record<string, unknown> {
  const lignes =
    "lines" in draft
      ? draft.lines.map((l) => ({
          produit: l.name,
          quantite: l.quantity,
          unite: l.unit,
          ...(l.unitPrice === null ? {} : { prix_unitaire: l.unitPrice }),
          ...(l.short ? { stock_insuffisant: true, disponible: l.available } : {}),
        }))
      : undefined;
  switch (draft.action) {
    case "sale":
      return { action: "vente", lignes, total: draft.total, paiement: draft.paymentMethod, montant_recu: draft.amountReceived, client: draft.customer?.name ?? null };
    case "purchase":
      return { action: "entree_stock", lignes, total: draft.total, fournisseur: draft.supplier?.name ?? null };
    case "order":
      return {
        action: "commande",
        lignes,
        total: draft.total,
        frais_livraison: draft.deliveryFee,
        canal: draft.channel,
        client: draft.customer.name,
        montant_paye: draft.payload.amountPaid,
        paiement: draft.payload.paymentMethod,
        adresse: draft.payload.deliveryAddress || null,
      };
    case "payment":
      return { action: "paiement_client", montant: draft.amount, paiement: draft.method, client: draft.customer.name };
    case "stock_exit":
      return { action: "sortie_stock", produit: draft.product.name, quantite: draft.quantity, unite: draft.product.unit, motif: draft.reasonLabel, note: draft.note || null };
    case "order_status":
      return { action: "statut_commande", commande: draft.order.number, client: draft.order.customerName, etat_actuel: ORDER_STATUS_LABELS[draft.from], nouvel_etat: ORDER_STATUS_LABELS[draft.to] };
    case "product":
      return { action: "nouveau_produit", nom: draft.name, unite: draft.unit, prix_vente: draft.salePrice, prix_achat: draft.costPrice, categorie: draft.category?.name ?? null, stock_initial: draft.initialStock };
    case "price":
      return { action: "prix", produit: draft.product.name, ancien_prix_vente: draft.oldSalePrice, prix_vente: draft.salePrice, prix_achat: draft.costPrice };
    case "customer":
      return { action: "nouveau_client", nom: draft.name, telephone: draft.phone || null, adresse: draft.address || null };
    case "supplier":
      return { action: "nouveau_fournisseur", nom: draft.name, telephone: draft.phone || null, note: draft.note || null };
  }
}

/**
 * Brouillons de l'assistant : les arguments donnés par l'IA deviennent une charge exacte pour l'action existante.
 * Rien n'est enregistré ici. L'action revérifie tout (droits, stock, prix) quand le commerçant appuie sur Valider.
 */
import { z } from "zod";
import { ORDER_CHANNELS, PAYING_METHODS, SALE_METHODS, type SaleMethod } from "@/lib/domain/sales";
import { findByName, type MatchResult } from "./match";
import { lineTotal } from "./money";
import type { DraftToolName } from "./tools";

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
export interface DraftCatalog {
  products: CatalogProduct[];
  customers: CatalogParty[];
  suppliers: CatalogParty[];
}

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
  | { action: "payment"; amount: number; method: PayingMethod; customer: PartyRef; payload: PaymentPayload };

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
  const customer = ref(pick(findByName(args.client, catalog.customers), args.client, "client"));
  return {
    action: "payment",
    amount: args.montant,
    method: args.paiement,
    customer,
    payload: { customerId: customer.id, amount: args.montant, method: args.paiement },
  };
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
  }
}

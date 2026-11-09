// src/lib/domain/assistant/tools.ts
import { dayStart } from "@/lib/filters";
import type { Permission } from "@/lib/domain/permissions";
import { ORDER_CHANNELS, PAYING_METHODS, SALE_METHODS } from "@/lib/domain/sales";

export const READ_TOOLS = ["stock_produit", "resume_ventes", "clients_debiteurs", "commandes_en_cours"] as const;
export const DRAFT_TOOLS = ["brouillon_vente", "brouillon_entree_stock", "brouillon_commande", "brouillon_paiement_client"] as const;
export type ReadToolName = (typeof READ_TOOLS)[number];
export type DraftToolName = (typeof DRAFT_TOOLS)[number];
export type ToolName = ReadToolName | DraftToolName | "repondre";

export const LANGS = ["wo", "fr"] as const;
export type Lang = (typeof LANGS)[number];

export const PERIODS = ["aujourdhui", "hier", "7jours", "mois"] as const;
export type Period = (typeof PERIODS)[number];

export interface ToolAccess {
  can(p: Permission): boolean;
  modulePos: boolean;
  moduleOrders: boolean;
}

export function isReadTool(name: string): name is ReadToolName {
  return (READ_TOOLS as readonly string[]).includes(name);
}

export function isDraftTool(name: string): name is DraftToolName {
  return (DRAFT_TOOLS as readonly string[]).includes(name);
}

/** Outils proposés à l'IA pour ce rôle et ces modules. L'action existante revérifie les droits au moment de valider. */
export function allowedTools(access: ToolAccess): ToolName[] {
  const tools: ToolName[] = ["resume_ventes"];
  if (access.can("products.view")) tools.push("stock_produit");
  if (access.can("customers.manage")) tools.push("clients_debiteurs", "brouillon_paiement_client");
  if (access.can("orders.manage")) tools.push("commandes_en_cours");
  if (access.can("orders.manage") && access.moduleOrders) tools.push("brouillon_commande");
  if (access.can("sales.create") && access.modulePos) tools.push("brouillon_vente");
  if (access.can("stock.in")) tools.push("brouillon_entree_stock");
  tools.push("repondre");
  return tools;
}

export interface JsonSchema {
  type: "object" | "array" | "string" | "number" | "integer";
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: readonly string[];
}

export interface FunctionDeclaration {
  name: ToolName;
  description: string;
  parameters?: JsonSchema;
}

const str = (description: string): JsonSchema => ({ type: "string", description });
const int = (description: string): JsonSchema => ({ type: "integer", description });
const oneOf = (values: readonly string[], description: string): JsonSchema => ({ type: "string", enum: values, description });
const object = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({ type: "object", properties, required });

function lines(price: "vente" | "achat" | null): JsonSchema {
  const properties: Record<string, JsonSchema> = {
    produit: str("Nom exact du produit dans le catalogue si tu le reconnais, sinon tel que dit par le commerçant"),
    quantite: { type: "number", description: "Quantité (décimales permises pour kg, litre, mètre)" },
  };
  if (price === "vente") properties.prix_unitaire = int("Prix unitaire en FCFA, seulement si le commerçant dit un autre prix que le catalogue");
  if (price === "achat") properties.prix_achat = int("Prix d'achat unitaire en FCFA, seulement s'il est dit");
  return { type: "array", description: "Produits", items: object(properties, ["produit", "quantite"]) };
}

export function toolDeclarations(names: readonly ToolName[], opts: { costs: boolean }): FunctionDeclaration[] {
  const all: Record<ToolName, FunctionDeclaration> = {
    stock_produit: {
      name: "stock_produit",
      description: "Quantité disponible et prix de vente d'un produit.",
      parameters: object({ produit: str("Nom exact du produit dans le catalogue si tu le reconnais, sinon tel que dit par le commerçant") }, ["produit"]),
    },
    resume_ventes: {
      name: "resume_ventes",
      description: "Chiffre d'affaires et nombre de ventes sur une période.",
      parameters: object({ periode: oneOf(PERIODS, "Période : aujourdhui, hier, 7jours ou mois") }, ["periode"]),
    },
    clients_debiteurs: { name: "clients_debiteurs", description: "Clients qui doivent de l'argent (ventes à crédit non remboursées)." },
    commandes_en_cours: { name: "commandes_en_cours", description: "Commandes en ligne pas encore livrées." },
    brouillon_vente: {
      name: "brouillon_vente",
      description: "Prépare une vente en boutique. Rien n'est enregistré : le commerçant doit valider.",
      parameters: object(
        {
          lignes: lines("vente"),
          paiement: oneOf(SALE_METHODS, "cash (espèces), wave, orange_money ou credit (à crédit)"),
          client: str("Nom ou téléphone du client, obligatoire pour une vente à crédit"),
          montant_recu: int("Montant reçu en FCFA si le client paie seulement une partie"),
        },
        ["lignes", "paiement"],
      ),
    },
    brouillon_entree_stock: {
      name: "brouillon_entree_stock",
      description: "Prépare une entrée de stock (marchandise reçue). Rien n'est enregistré : le commerçant doit valider.",
      parameters: object({ lignes: lines(opts.costs ? "achat" : null), fournisseur: str("Nom du fournisseur s'il est dit") }, ["lignes"]),
    },
    brouillon_commande: {
      name: "brouillon_commande",
      description: "Prépare une commande en ligne pour un client existant. Rien n'est enregistré : le commerçant doit valider.",
      parameters: object(
        {
          client: str("Nom ou téléphone du client"),
          canal: oneOf(ORDER_CHANNELS, "Canal de la commande"),
          lignes: lines(null),
          frais_livraison: int("Frais de livraison en FCFA"),
          adresse: str("Adresse de livraison"),
          montant_paye: int("Montant déjà payé en FCFA"),
          paiement: oneOf(PAYING_METHODS, "Mode de paiement du montant déjà payé"),
        },
        ["client", "canal", "lignes"],
      ),
    },
    brouillon_paiement_client: {
      name: "brouillon_paiement_client",
      description: "Prépare le remboursement d'un client qui doit de l'argent. Rien n'est enregistré : le commerçant doit valider.",
      parameters: object(
        {
          client: str("Nom ou téléphone du client"),
          montant: int("Montant remboursé en FCFA"),
          paiement: oneOf(PAYING_METHODS, "Mode de paiement"),
        },
        ["client", "montant", "paiement"],
      ),
    },
    repondre: {
      name: "repondre",
      description: "Réponse finale au commerçant. À appeler pour terminer chaque demande.",
      parameters: object(
        {
          transcription: str("Ce que le commerçant a dit, mot pour mot, dans sa langue"),
          langue: oneOf(LANGS, "Langue principale du commerçant : wo (wolof) ou fr (français)"),
          texte: str("Réponse courte dans la langue du commerçant, faite pour être lue à voix haute"),
        },
        ["transcription", "langue", "texte"],
      ),
    },
  };
  return names.map((name) => all[name]);
}

const DAY = 86_400_000;

/** Début (et fin éventuelle) d'une période. Dakar est à l'heure UTC toute l'année. */
export function periodRange(period: Period, now = new Date()): { from: Date; to?: Date } {
  const today = dayStart(now);
  switch (period) {
    case "aujourdhui":
      return { from: today };
    case "hier":
      return { from: new Date(today.getTime() - DAY), to: today };
    case "7jours":
      return { from: new Date(today.getTime() - 6 * DAY) };
    case "mois":
      return { from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) };
  }
}

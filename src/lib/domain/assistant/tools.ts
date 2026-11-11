// src/lib/domain/assistant/tools.ts
import { dayStart } from "@/lib/filters";
import type { Permission } from "@/lib/domain/permissions";
import { ORDER_CHANNELS, PAYING_METHODS, SALE_METHODS } from "@/lib/domain/sales";
import { EXIT_REASONS, LOSS_REASONS } from "@/lib/domain/stock";
import { UNITS, type UnitId } from "@/lib/format";

export const READ_TOOLS = ["stock_produit", "resume_ventes", "resume_catalogue", "clients_debiteurs", "commandes_en_cours"] as const;

export const DRAFT_TOOLS = [
  "brouillon_vente",
  "brouillon_entree_stock",
  "brouillon_sortie_stock",
  "brouillon_commande",
  "brouillon_statut_commande",
  "brouillon_paiement_client",
  "brouillon_produit",
  "brouillon_prix",
  "brouillon_client",
  "brouillon_fournisseur",
] as const;

/** Motifs d'une sortie de stock : pertes d'abord, puis sorties (clés de lib/domain/stock). */
export const STOCK_REASON_KEYS = [...Object.keys(LOSS_REASONS), ...Object.keys(EXIT_REASONS)] as [
  keyof typeof LOSS_REASONS | keyof typeof EXIT_REASONS,
  ...(keyof typeof LOSS_REASONS | keyof typeof EXIT_REASONS)[],
];
/** États qu'une commande peut prendre à la demande (jamais « new »). */
export const STATUS_TARGETS = ["preparing", "shipping", "delivered", "cancelled", "returned"] as const;
export const UNIT_IDS = UNITS.map((u) => u.id) as [UnitId, ...UnitId[]];
export type ReadToolName = (typeof READ_TOOLS)[number];
export type DraftToolName = (typeof DRAFT_TOOLS)[number];
export const ECRANS = [
  "tableau_de_bord",
  "rapports",
  "produits",
  "stock_bas",
  "ruptures",
  "ventes",
  "ventes_credit",
  "derniere_vente",
  "vendre",
  "commandes",
  "nouvelle_commande",
  "clients",
  "client",
  "produit",
  "nouveau_produit",
  "fournisseurs",
  "stock",
  "entree_stock",
  "sortie_stock",
  "inventaire",
  "transfert",
  "historique_stock",
  "factures",
  "equipe",
  "parametres",
  "licence",
] as const;
/** Outils joués par le téléphone lui-même (lecture de l'écran, appui sur un bouton, envoi WhatsApp) : ils ne passent pas par le serveur. */
export const OUTILS_ECRAN = ["lire_ecran", "cliquer", "envoyer_whatsapp"] as const;
export type OutilEcran = (typeof OUTILS_ECRAN)[number];
export type SpecialToolName = "montrer_ecran" | "confirmer" | OutilEcran;
export type ToolName = ReadToolName | DraftToolName | SpecialToolName | "repondre";

export const LANGS = ["wo", "fr"] as const;
export type Lang = (typeof LANGS)[number];

export const PERIODS = ["aujourdhui", "hier", "7jours", "mois"] as const;
export type Period = (typeof PERIODS)[number];

export interface ToolAccess {
  can(p: Permission): boolean;
  modulePos: boolean;
  moduleOrders: boolean;
  /** Offre en lecture seule : aucun brouillon. */
  readOnly?: boolean;
}

export function isReadTool(name: string): name is ReadToolName {
  return (READ_TOOLS as readonly string[]).includes(name);
}

export function isDraftTool(name: string): name is DraftToolName {
  return (DRAFT_TOOLS as readonly string[]).includes(name);
}

/** Outils proposés à l'IA pour ce rôle et ces modules. L'écran et l'action revérifient les droits au moment d'enregistrer. */
/**
 * `attente` : une tâche attend l'accord du commerçant (ancienne voie). `direct` : dialogue en direct, où l'IA parle
 * elle-même (pas de « repondre ») et où l'accord peut arriver à tout moment (« confirmer » toujours proposé).
 */
export function allowedTools(access: ToolAccess, opts: { attente?: boolean; direct?: boolean } = {}): ToolName[] {
  const tools: ToolName[] = ["resume_ventes", "montrer_ecran"];
  if (access.can("products.view")) tools.push("stock_produit", "resume_catalogue");
  if (access.can("customers.manage")) tools.push("clients_debiteurs");
  if (access.can("orders.manage")) tools.push("commandes_en_cours");
  if (!access.readOnly) {
    if (access.can("customers.manage")) tools.push("brouillon_paiement_client", "brouillon_client");
    if (access.can("orders.manage") && access.moduleOrders) tools.push("brouillon_commande", "brouillon_statut_commande");
    if (access.can("sales.create") && access.modulePos) tools.push("brouillon_vente");
    if (access.can("stock.in")) tools.push("brouillon_entree_stock");
    if (access.can("stock.adjust")) tools.push("brouillon_sortie_stock");
    if (access.can("products.manage")) tools.push("brouillon_produit", "brouillon_prix");
    if (access.can("suppliers.manage")) tools.push("brouillon_fournisseur");
  }
  // Dialogue en direct : l'assistant se sert de l'écran comme une personne (lire, cliquer, envoyer un reçu)
  if (opts.direct) tools.push(...OUTILS_ECRAN);
  if (opts.attente || opts.direct) tools.push("confirmer");
  if (!opts.direct) tools.push("repondre");
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
    brouillon_sortie_stock: {
      name: "brouillon_sortie_stock",
      description: "Prépare une sortie de stock : une perte (casse, vol, perte, péremption, erreur de saisie) ou une sortie (vendu hors caisse, utilisé, offert, autre).",
      parameters: object(
        {
          produit: str("Nom exact du produit dans le catalogue si tu le reconnais, sinon tel que dit par le commerçant"),
          quantite: { type: "number", description: "Quantité sortie" },
          motif: oneOf(STOCK_REASON_KEYS, "breakage (casse), theft (vol), loss (perte), expired (péremption), entry_error (erreur de saisie), sold_offline (vendu hors caisse), used (utilisé), gift (offert), other (autre)"),
          note: str("Précision éventuelle"),
        },
        ["produit", "quantite", "motif"],
      ),
    },
    brouillon_statut_commande: {
      name: "brouillon_statut_commande",
      description: "Change l'état d'une commande en cours.",
      parameters: object(
        {
          commande: str("Numéro de la commande, ou nom du client qui l'a passée"),
          etat: oneOf(STATUS_TARGETS, "preparing (en préparation), shipping (en livraison), delivered (livrée), cancelled (annulée), returned (retournée)"),
        },
        ["commande", "etat"],
      ),
    },
    brouillon_produit: {
      name: "brouillon_produit",
      description: "Prépare la fiche d'un nouveau produit.",
      parameters: object(
        {
          nom: str("Nom du produit"),
          prix_vente: int("Prix de vente en FCFA"),
          ...(opts.costs ? { prix_achat: int("Prix d'achat en FCFA, s'il est dit") } : {}),
          unite: oneOf(UNIT_IDS, "Unité de vente : piece, kg, g, m, l, sac, carton, paquet, boite, rouleau, sachet, bouteille, paire, lot"),
          categorie: str("Catégorie, si elle est dite"),
          stock_initial: { type: "number", description: "Quantité déjà en boutique, si elle est dite" },
          reference: str("Référence, si elle est dite"),
        },
        ["nom", "prix_vente"],
      ),
    },
    brouillon_prix: {
      name: "brouillon_prix",
      description: "Change le prix de vente d'un produit existant (et son prix d'achat s'il est dit).",
      parameters: object(
        {
          produit: str("Nom exact du produit dans le catalogue si tu le reconnais, sinon tel que dit par le commerçant"),
          prix_vente: int("Nouveau prix de vente en FCFA"),
          ...(opts.costs ? { prix_achat: int("Nouveau prix d'achat en FCFA, s'il est dit") } : {}),
        },
        ["produit"],
      ),
    },
    brouillon_client: {
      name: "brouillon_client",
      description: "Prépare la fiche d'un nouveau client.",
      parameters: object({ nom: str("Nom du client"), telephone: str("Téléphone, s'il est dit"), adresse: str("Adresse, si elle est dite") }, ["nom"]),
    },
    brouillon_fournisseur: {
      name: "brouillon_fournisseur",
      description: "Prépare la fiche d'un nouveau fournisseur.",
      parameters: object({ nom: str("Nom du fournisseur"), telephone: str("Téléphone, s'il est dit"), note: str("Précision éventuelle") }, ["nom"]),
    },
    montrer_ecran: {
      name: "montrer_ecran",
      description: "Ouvre une page de l'application devant le commerçant (et montre du doigt le chiffre principal quand il y en a un).",
      parameters: object(
        {
          ecran: oneOf(
            ECRANS,
            "tableau_de_bord ; rapports ; produits (liste du catalogue) ; stock_bas ; ruptures ; ventes ; ventes_credit ; derniere_vente (le reçu de la dernière vente) ; vendre (la caisse) ; commandes ; nouvelle_commande ; clients ; client (fiche, avec nom) ; produit (fiche, avec nom) ; nouveau_produit ; fournisseurs ; stock ; entree_stock ; sortie_stock ; inventaire ; transfert ; historique_stock ; factures ; equipe ; parametres ; licence",
          ),
          periode: oneOf(PERIODS, "Période pour les ventes ou les rapports"),
          nom: str("Nom du client ou du produit, pour ouvrir sa fiche"),
        },
        ["ecran"],
      ),
    },
    resume_catalogue: {
      name: "resume_catalogue",
      description: "État du catalogue : nombre de produits, en stock, stock bas, ruptures (avec les noms) et valeur du stock.",
    },
    lire_ecran: {
      name: "lire_ecran",
      description: "Lit ce qui est affiché à l'écran en ce moment (page, chiffres, listes, fenêtre ouverte), pour en parler au commerçant ou décider quoi faire.",
    },
    cliquer: {
      name: "cliquer",
      description: "Appuie sur un bouton, un onglet ou un lien visible à l'écran, désigné par son texte. Un bouton qui enregistre, envoie, paie, annule ou supprime demande d'abord l'accord du commerçant.",
      parameters: object({ libelle: str("Texte du bouton ou du lien tel qu'il est écrit à l'écran (lis l'écran avant si besoin)") }, ["libelle"]),
    },
    envoyer_whatsapp: {
      name: "envoyer_whatsapp",
      description: "Envoie sur WhatsApp le PDF du document ouvert à l'écran : reçu de vente, facture ou devis (ouvre-le avant, par exemple derniere_vente pour le reçu de la dernière vente).",
    },
    confirmer: {
      name: "confirmer",
      description: "Réponse du commerçant à « Je l'enregistre ? » pour la tâche remplie à l'écran.",
      parameters: object({ reponse: oneOf(["oui", "non"], "oui : waaw, oui, bind ko, def ko ; non : déedéet, non, bayyil") }, ["reponse"]),
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

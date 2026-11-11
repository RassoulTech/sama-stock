// src/components/assistant/pilote/types.ts
import type { OrderChannel, PayingMethod } from "@/lib/domain/assistant/drafts";
import type { OrderStatus } from "@/lib/domain/orders";
import type { SaleMethod } from "@/lib/domain/sales";

/** Ce que rend le bouton final d'un écran quand l'assistant appuie dessus. */
export interface ResultatPilote {
  ok: boolean;
  message: string;
}

export interface PiloteVente {
  vider(): void;
  ajouterProduit(productId: string, quantite: number): void;
  prixNegocie(productId: string, prix: number): void;
  ouvrirEncaisser(): void;
}
export interface PiloteEncaisser {
  paiement(methode: SaleMethod): void;
  montantRecu(montant: number): void;
  client(customerId: string | null): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteEntree {
  vider(): void;
  ajouterLigne(productId: string, quantite: number, coutUnitaire: number | null): void;
  fournisseur(supplierId: string | null): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteSortie {
  produit(productId: string): void;
  genre(genre: "loss" | "exit"): void;
  motif(motif: string): void;
  quantite(quantite: number): void;
  note(texte: string): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteCommande {
  vider(): void;
  client(customerId: string): void;
  canal(canal: OrderChannel): void;
  ajouterLigne(productId: string, quantite: number): void;
  livraison(adresse: string, frais: number): void;
  acompte(montant: number, methode: PayingMethod | null): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteStatutCommande {
  changerStatut(etat: OrderStatus): Promise<ResultatPilote>;
}
export interface PilotePaiement {
  ouvrir(): void;
  montant(montant: number): void;
  methode(methode: PayingMethod): void;
  enregistrer(): Promise<ResultatPilote>;
}
export interface PiloteProduit {
  champ(cle: "name" | "reference" | "salePrice" | "costPrice", valeur: string | number): void;
  unite(unite: string): void;
  categorie(categoryId: string | null, nouvelle: string | null): void;
  stockInitial(quantite: number): void;
  enregistrer(): Promise<ResultatPilote>;
}
/** Fiches client et fournisseur (champs non contrôlés, écrits directement). */
export interface PiloteFiche {
  ouvrir(): void;
  champ(nom: "name" | "phone" | "address" | "note", valeur: string): void;
  enregistrer(): Promise<ResultatPilote>;
}

export interface Pilotes {
  vente: PiloteVente;
  "vente.encaisser": PiloteEncaisser;
  entree: PiloteEntree;
  sortie: PiloteSortie;
  commande: PiloteCommande;
  "commande.statut": PiloteStatutCommande;
  paiement: PilotePaiement;
  produit: PiloteProduit;
  client: PiloteFiche;
  fournisseur: PiloteFiche;
}
export type NomPilote = keyof Pilotes;

export type Etape =
  | { type: "ouvrir"; url: string; texte: string }
  | { type: "attendre"; pilote: NomPilote }
  | { type: "agir"; pilote: NomPilote; op: string; args: unknown[]; cible: string | null; texte: string }
  | { type: "confirmer"; cible: string; resume: string }
  | { type: "enregistrer"; pilote: NomPilote; op: string; args: unknown[]; cible: string }
  | { type: "montrer"; cible: string; texte: string };

type Operations<P> = { [K in keyof P]: P[K] extends (...args: never[]) => unknown ? K : never }[keyof P] & string;
type Arguments<P, K extends keyof P> = P[K] extends (...args: infer A) => unknown ? A : never;

/** Un geste sur l'écran : le doigt va sur `cible`, puis l'opération du pilote s'exécute. */
export function agir<N extends NomPilote, O extends Operations<Pilotes[N]>>(
  pilote: N,
  op: O,
  args: Arguments<Pilotes[N], O>,
  cible: string | null,
  texte: string,
): Etape {
  return { type: "agir", pilote, op, args: args as unknown[], cible, texte };
}

/** Le bouton final : n'est joué qu'après le « oui » du commerçant. */
export function finir<N extends NomPilote, O extends Operations<Pilotes[N]>>(pilote: N, op: O, args: Arguments<Pilotes[N], O>, cible: string): Etape {
  return { type: "enregistrer", pilote, op, args: args as unknown[], cible };
}

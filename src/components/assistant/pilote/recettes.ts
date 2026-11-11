// src/components/assistant/pilote/recettes.ts
import type { Draft } from "@/lib/domain/assistant/drafts";
import type { Mission } from "@/lib/domain/assistant/mission";
import { formatFCFA } from "@/lib/format";
import { agir, finir, type Etape, type NomPilote } from "./types";

const PAIEMENT: Record<string, string> = { cash: "espèces", wave: "Wave", orange_money: "Orange Money", credit: "à crédit" };

const ouvrir = (url: string, texte: string): Etape => ({ type: "ouvrir", url, texte });
const attendre = (pilote: NomPilote): Etape => ({ type: "attendre", pilote });
const confirmer = (cible: string, resume: string): Etape => ({ type: "confirmer", cible, resume });
const si = (condition: unknown, ...etapes: Etape[]): Etape[] => (condition ? etapes : []);

/** Les étapes que le téléphone joue pour une mission ; le bouton final vient toujours après « confirmer ». */
export function etapesPour(mission: Mission): Etape[] {
  if (mission.type === "ecran") {
    return [ouvrir(mission.ecran.url, `J'ouvre ${mission.ecran.titre}…`), { type: "montrer", cible: mission.ecran.cible, texte: mission.ecran.titre }];
  }
  return etapesTache(mission.tache);
}

function fiche(pilote: "client" | "fournisseur", t: Extract<Draft, { action: "customer" | "supplier" }>): Etape[] {
  const champs: ["name" | "phone" | "address" | "note", string, string][] =
    t.action === "customer"
      ? [["name", t.name, "client.nom"], ["phone", t.phone, "client.telephone"], ["address", t.address, "client.adresse"]]
      : [["name", t.name, "fournisseur.nom"], ["phone", t.phone, "fournisseur.telephone"], ["note", t.note, "fournisseur.note"]];
  return [
    ouvrir(pilote === "client" ? "/clients" : "/fournisseurs", pilote === "client" ? "J'ouvre les clients…" : "J'ouvre les fournisseurs…"),
    attendre(pilote),
    { type: "agir", pilote, op: "ouvrir", args: [], cible: `${pilote}.nouveau`, texte: "J'ouvre une nouvelle fiche…" },
    ...champs.filter(([, valeur]) => valeur).map(([nom, valeur, cible]): Etape => ({ type: "agir", pilote, op: "champ", args: [nom, valeur], cible, texte: `${valeur}…` })),
    confirmer(`${pilote}.valider`, `${pilote === "client" ? "Nouveau client" : "Nouveau fournisseur"} : ${t.name}`),
    { type: "enregistrer", pilote, op: "enregistrer", args: [], cible: `${pilote}.valider` },
  ];
}

function etapesTache(t: Draft): Etape[] {
  switch (t.action) {
    case "sale":
      return [
        ouvrir("/vendre", "J'ouvre la caisse…"),
        attendre("vente"),
        agir("vente", "vider", [], null, "Je prépare un panier vide…"),
        ...t.lines.map((l) => agir("vente", "ajouterProduit", [l.productId, l.quantity], `vente.produit.${l.productId}`, `J'ajoute ${l.quantity} × ${l.name}…`)),
        ...t.payload.items.flatMap((i) =>
          i.unitPrice === undefined ? [] : [agir("vente", "prixNegocie", [i.productId, i.unitPrice], `vente.produit.${i.productId}`, `Prix négocié : ${formatFCFA(i.unitPrice)}…`)],
        ),
        agir("vente", "ouvrirEncaisser", [], "vente.encaisser", "J'ouvre l'encaissement…"),
        attendre("vente.encaisser"),
        agir("vente.encaisser", "paiement", [t.paymentMethod], `vente.paiement.${t.paymentMethod}`, `Paiement : ${PAIEMENT[t.paymentMethod]}…`),
        ...si(t.paymentMethod !== "credit", agir("vente.encaisser", "montantRecu", [t.amountReceived], "vente.montant-recu", `Montant reçu : ${formatFCFA(t.amountReceived)}…`)),
        ...si(t.customer, agir("vente.encaisser", "client", [t.customer?.id ?? null], "vente.client", `Client : ${t.customer?.name}…`)),
        confirmer("vente.valider", `Vente de ${formatFCFA(t.total)} · ${PAIEMENT[t.paymentMethod]}${t.customer ? ` · ${t.customer.name}` : ""}`),
        finir("vente.encaisser", "enregistrer", [], "vente.valider"),
      ];
    case "purchase":
      return [
        ouvrir("/stock/entree", "J'ouvre l'entrée de stock…"),
        attendre("entree"),
        agir("entree", "vider", [], null, "Je prépare une entrée vide…"),
        ...t.lines.map((l, i) =>
          agir("entree", "ajouterLigne", [l.productId, l.quantity, t.payload.items[i]?.unitCost ?? null], "entree.ajouter", `J'ajoute ${l.quantity} × ${l.name}…`),
        ),
        ...si(t.supplier, agir("entree", "fournisseur", [t.supplier?.id ?? null], "entree.fournisseur", `Fournisseur : ${t.supplier?.name}…`)),
        confirmer("entree.valider", `Entrée de ${t.lines.length} produit${t.lines.length > 1 ? "s" : ""}${t.total !== null ? ` · ${formatFCFA(t.total)}` : ""}`),
        finir("entree", "enregistrer", [], "entree.valider"),
      ];
    case "stock_exit":
      return [
        ouvrir(`/stock/sortie?produit=${t.product.id}`, "J'ouvre la sortie de stock…"),
        attendre("sortie"),
        agir("sortie", "produit", [t.product.id], "sortie.produit", `Produit : ${t.product.name}…`),
        agir("sortie", "genre", [t.kind], `sortie.genre.${t.kind}`, t.kind === "loss" ? "C'est une perte…" : "C'est une sortie…"),
        agir("sortie", "motif", [t.reason], "sortie.motif", `Motif : ${t.reasonLabel}…`),
        agir("sortie", "quantite", [t.quantity], "sortie.quantite", `Quantité : ${t.quantity}…`),
        ...si(t.note, agir("sortie", "note", [t.note], "sortie.note", "J'ajoute la note…")),
        confirmer("sortie.valider", `${t.kind === "loss" ? "Perte" : "Sortie"} : ${t.quantity} × ${t.product.name} (${t.reasonLabel})`),
        finir("sortie", "enregistrer", [], "sortie.valider"),
      ];
    case "order":
      return [
        ouvrir("/commandes/nouvelle", "J'ouvre une nouvelle commande…"),
        attendre("commande"),
        agir("commande", "vider", [], null, "Je prépare une commande vide…"),
        agir("commande", "client", [t.customer.id], "commande.client", `Client : ${t.customer.name}…`),
        agir("commande", "canal", [t.channel], `commande.canal.${t.channel}`, "Canal de la commande…"),
        ...t.lines.map((l) => agir("commande", "ajouterLigne", [l.productId, l.quantity], "commande.ajouter", `J'ajoute ${l.quantity} × ${l.name}…`)),
        ...si(t.payload.deliveryAddress || t.deliveryFee, agir("commande", "livraison", [t.payload.deliveryAddress, t.deliveryFee], "commande.livraison", "Livraison…")),
        ...si(t.payload.amountPaid > 0, agir("commande", "acompte", [t.payload.amountPaid, t.payload.paymentMethod], "commande.acompte", `Acompte : ${formatFCFA(t.payload.amountPaid)}…`)),
        confirmer("commande.valider", `Commande de ${t.customer.name} · ${formatFCFA(t.total)}`),
        finir("commande", "enregistrer", [], "commande.valider"),
      ];
    case "order_status":
      return [
        ouvrir(`/commandes/${t.order.id}`, `J'ouvre la commande ${t.order.number}…`),
        attendre("commande.statut"),
        confirmer(`commande.statut.${t.to}`, `Commande ${t.order.number} (${t.order.customerName}) : ${t.label}`),
        finir("commande.statut", "changerStatut", [t.to], `commande.statut.${t.to}`),
      ];
    case "payment":
      return [
        ouvrir(`/clients/${t.customer.id}`, `J'ouvre la fiche de ${t.customer.name}…`),
        attendre("paiement"),
        agir("paiement", "ouvrir", [], "paiement.ouvrir", "J'ouvre le remboursement…"),
        agir("paiement", "montant", [t.amount], "paiement.montant", `Montant : ${formatFCFA(t.amount)}…`),
        agir("paiement", "methode", [t.method], `paiement.methode.${t.method}`, `Paiement : ${PAIEMENT[t.method]}…`),
        confirmer("paiement.valider", `Remboursement de ${t.customer.name} : ${formatFCFA(t.amount)} · ${PAIEMENT[t.method]}`),
        finir("paiement", "enregistrer", [], "paiement.valider"),
      ];
    case "product":
      return [
        ouvrir("/produits/nouveau", "J'ouvre un nouveau produit…"),
        attendre("produit"),
        agir("produit", "champ", ["name", t.name], "produit.nom", `Nom : ${t.name}…`),
        agir("produit", "unite", [t.unit], "produit.unite", "Unité de vente…"),
        ...si(t.category, agir("produit", "categorie", [t.category?.id ?? null, t.category?.id ? null : (t.category?.name ?? null)], "produit.categorie", `Catégorie : ${t.category?.name}…`)),
        ...si(t.costPrice !== null, agir("produit", "champ", ["costPrice", t.costPrice ?? 0], "produit.prix-achat", `Prix d'achat : ${formatFCFA(t.costPrice ?? 0)}…`)),
        agir("produit", "champ", ["salePrice", t.salePrice], "produit.prix-vente", `Prix de vente : ${formatFCFA(t.salePrice)}…`),
        ...si(t.reference, agir("produit", "champ", ["reference", t.reference], "produit.reference", "Référence…")),
        ...si(t.initialStock > 0, agir("produit", "stockInitial", [t.initialStock], "produit.stock-initial", `Stock de départ : ${t.initialStock}…`)),
        confirmer("produit.valider", `Nouveau produit : ${t.name} · ${formatFCFA(t.salePrice)}`),
        finir("produit", "enregistrer", [], "produit.valider"),
      ];
    case "price":
      return [
        ouvrir(`/produits/${t.product.id}/modifier`, `J'ouvre la fiche de ${t.product.name}…`),
        attendre("produit"),
        ...si(t.salePrice !== null, agir("produit", "champ", ["salePrice", t.salePrice ?? 0], "produit.prix-vente", `Nouveau prix : ${formatFCFA(t.salePrice ?? 0)}…`)),
        ...si(t.costPrice !== null, agir("produit", "champ", ["costPrice", t.costPrice ?? 0], "produit.prix-achat", `Prix d'achat : ${formatFCFA(t.costPrice ?? 0)}…`)),
        confirmer("produit.valider", `${t.product.name} : ${t.salePrice !== null ? `${formatFCFA(t.oldSalePrice)} → ${formatFCFA(t.salePrice)}` : "nouveau prix d'achat"}`),
        finir("produit", "enregistrer", [], "produit.valider"),
      ];
    case "customer":
      return fiche("client", t);
    case "supplier":
      return fiche("fournisseur", t);
  }
}

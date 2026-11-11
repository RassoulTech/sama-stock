import { describe, expect, it } from "vitest";
import { CLIENT, COMMANDE, ENTREE, FOURNISSEUR, PAIEMENT, PRIX, PRODUIT, SORTIE, STATUT, VENTE_CREDIT, VENTE_WAVE } from "./exemples";
import { etapesPour } from "./recettes";
import type { Etape } from "./types";

const plan = (etapes: Etape[]) =>
  etapes.map((e) => {
    switch (e.type) {
      case "ouvrir":
        return `ouvrir ${e.url}`;
      case "attendre":
        return `attendre ${e.pilote}`;
      case "agir":
      case "enregistrer":
        return `${e.type} ${e.pilote}.${e.op}(${JSON.stringify(e.args).slice(1, -1)})${e.cible ? ` @${e.cible}` : ""}`;
      case "confirmer":
      case "montrer":
        return `${e.type} @${e.cible}`;
    }
  });

describe("etapesPour — tâches", () => {
  it("plays a sale at the till: products, negotiated price, payment, customer, then asks", () => {
    expect(plan(etapesPour(VENTE_WAVE))).toEqual([
      "ouvrir /vendre",
      "attendre vente",
      "agir vente.vider()",
      'agir vente.ajouterProduit("p1",2) @vente.produit.p1',
      'agir vente.prixNegocie("p1",550) @vente.produit.p1',
      "agir vente.ouvrirEncaisser() @vente.encaisser",
      "attendre vente.encaisser",
      'agir vente.encaisser.paiement("wave") @vente.paiement.wave',
      "agir vente.encaisser.montantRecu(1100) @vente.montant-recu",
      'agir vente.encaisser.client("c1") @vente.client',
      "confirmer @vente.valider",
      "enregistrer vente.encaisser.enregistrer() @vente.valider",
    ]);
  });
  it("skips the amount received for a credit sale", () => {
    expect(plan(etapesPour(VENTE_CREDIT)).some((l) => l.includes("montantRecu"))).toBe(false);
  });
  it("puts the summary of the sale in the question", () => {
    const confirmer = etapesPour(VENTE_WAVE).find((e) => e.type === "confirmer");
    expect(confirmer?.type === "confirmer" && confirmer.resume).toContain("Wave · Awa Ndiaye");
  });
  it("plays a stock entry with its supplier", () => {
    expect(plan(etapesPour(ENTREE))).toEqual([
      "ouvrir /stock/entree",
      "attendre entree",
      "agir entree.vider()",
      'agir entree.ajouterLigne("p1",10,450) @entree.ajouter',
      'agir entree.fournisseur("s1") @entree.fournisseur',
      "confirmer @entree.valider",
      "enregistrer entree.enregistrer() @entree.valider",
    ]);
  });
  it("chooses the kind before the reason of a stock exit", () => {
    expect(plan(etapesPour(SORTIE))).toEqual([
      "ouvrir /stock/sortie?produit=p3",
      "attendre sortie",
      'agir sortie.produit("p3") @sortie.produit',
      'agir sortie.genre("loss") @sortie.genre.loss',
      'agir sortie.motif("breakage") @sortie.motif',
      "agir sortie.quantite(1) @sortie.quantite",
      "confirmer @sortie.valider",
      "enregistrer sortie.enregistrer() @sortie.valider",
    ]);
  });
  it("plays an order with delivery and deposit", () => {
    expect(plan(etapesPour(COMMANDE))).toEqual([
      "ouvrir /commandes/nouvelle",
      "attendre commande",
      "agir commande.vider()",
      'agir commande.client("c1") @commande.client',
      'agir commande.canal("whatsapp") @commande.canal.whatsapp',
      'agir commande.ajouterLigne("p1",3) @commande.ajouter',
      'agir commande.livraison("Parcelles U17",1000) @commande.livraison',
      'agir commande.acompte(1000,"wave") @commande.acompte',
      "confirmer @commande.valider",
      "enregistrer commande.enregistrer() @commande.valider",
    ]);
  });
  it("changes an order status after asking, without the « are you sure » window", () => {
    expect(plan(etapesPour(STATUT))).toEqual([
      "ouvrir /commandes/o1",
      "attendre commande.statut",
      "confirmer @commande.statut.delivered",
      'enregistrer commande.statut.changerStatut("delivered") @commande.statut.delivered',
    ]);
  });
  it("records a customer payment from the customer page", () => {
    expect(plan(etapesPour(PAIEMENT))).toEqual([
      "ouvrir /clients/c1",
      "attendre paiement",
      "agir paiement.ouvrir() @paiement.ouvrir",
      "agir paiement.montant(5000) @paiement.montant",
      'agir paiement.methode("cash") @paiement.methode.cash',
      "confirmer @paiement.valider",
      "enregistrer paiement.enregistrer() @paiement.valider",
    ]);
  });
  it("fills a new product with a new category", () => {
    expect(plan(etapesPour(PRODUIT))).toEqual([
      "ouvrir /produits/nouveau",
      "attendre produit",
      'agir produit.champ("name","Savon Madar") @produit.nom',
      'agir produit.unite("piece") @produit.unite',
      'agir produit.categorie(null,"Hygiène") @produit.categorie',
      'agir produit.champ("costPrice",180) @produit.prix-achat',
      'agir produit.champ("salePrice",250) @produit.prix-vente',
      "agir produit.stockInitial(24) @produit.stock-initial",
      "confirmer @produit.valider",
      "enregistrer produit.enregistrer() @produit.valider",
    ]);
  });
  it("changes a price on the edit page", () => {
    expect(plan(etapesPour(PRIX))).toEqual([
      "ouvrir /produits/p3/modifier",
      "attendre produit",
      'agir produit.champ("salePrice",1400) @produit.prix-vente',
      "confirmer @produit.valider",
      "enregistrer produit.enregistrer() @produit.valider",
    ]);
  });
  it("fills only the fields that were said on a customer or supplier card", () => {
    expect(plan(etapesPour(CLIENT))).toEqual([
      "ouvrir /clients",
      "attendre client",
      "agir client.ouvrir() @client.nouveau",
      'agir client.champ("name","Fatou Sall") @client.nom',
      'agir client.champ("phone","771234567") @client.telephone',
      "confirmer @client.valider",
      "enregistrer client.enregistrer() @client.valider",
    ]);
    expect(plan(etapesPour(FOURNISSEUR))).toContain('agir fournisseur.champ("note","livre le lundi") @fournisseur.note');
  });
});

describe("etapesPour — écrans", () => {
  it("opens the page and points at the figure", () => {
    expect(etapesPour({ type: "ecran", ecran: { ecran: "ventes", url: "/ventes?periode=today", cible: "ventes.total", titre: "Ventes" } })).toEqual([
      { type: "ouvrir", url: "/ventes?periode=today", texte: "J'ouvre Ventes…" },
      { type: "montrer", cible: "ventes.total", texte: "Ventes" },
    ]);
  });
  it("only opens a page that has nothing to point at", () => {
    expect(etapesPour({ type: "ecran", ecran: { ecran: "fournisseurs", url: "/fournisseurs", cible: "", titre: "Fournisseurs" } })).toEqual([
      { type: "ouvrir", url: "/fournisseurs", texte: "J'ouvre Fournisseurs…" },
    ]);
  });
});

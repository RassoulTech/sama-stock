import { describe, expect, it } from "vitest";
import { buildEcran, type EcranAccess } from "./ecrans";
import { missionForModel } from "./mission";

const catalog = {
  products: [{ id: "p1", name: "Riz parfumé 1kg", unit: "kg", salePrice: 600, costPrice: null, available: 40 }],
  customers: [{ id: "c1", name: "Awa Ndiaye", phone: null }],
  suppliers: [{ id: "f1", name: "Sococim Distribution", phone: null }],
  categories: [
    { id: "k1", name: "Ciment et liants" },
    { id: "k2", name: "Peinture" },
  ],
};
const all: EcranAccess = { reports: true, products: true, orders: true, customers: true };

describe("buildEcran", () => {
  it("opens the dashboard", () => {
    expect(buildEcran({ ecran: "tableau_de_bord" }, catalog, all)).toEqual({
      ok: true,
      ecran: { ecran: "tableau_de_bord", url: "/tableau-de-bord", cible: "tdb.chiffre", titre: "Tableau de bord" },
    });
  });
  it("maps the period of the sales page", () => {
    expect(buildEcran({ ecran: "ventes", periode: "hier" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/ventes?periode=yesterday", cible: "ventes.total" } });
    expect(buildEcran({ ecran: "ventes_credit" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/ventes?periode=mois&etat=credit" } });
  });
  it("falls back to the dashboard without advanced reports", () => {
    expect(buildEcran({ ecran: "rapports", periode: "mois" }, catalog, { ...all, reports: false })).toMatchObject({ ok: true, ecran: { ecran: "tableau_de_bord" } });
    expect(buildEcran({ ecran: "rapports", periode: "7jours" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/rapports?periode=7j" } });
  });
  it("opens low stock and out of stock lists", () => {
    expect(buildEcran({ ecran: "stock_bas" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/produits?etat=bas", cible: "produits.liste" } });
    expect(buildEcran({ ecran: "ruptures" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/produits?etat=rupture" } });
  });
  it("opens a customer or a product found by name", () => {
    expect(buildEcran({ ecran: "client", nom: "awa" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/clients/c1", cible: "client.solde", titre: "Awa Ndiaye" } });
    expect(buildEcran({ ecran: "produit", nom: "riz" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/produits/p1", cible: "produit.stock" } });
  });
  it("opens the reports on the section asked, with a precise day turned into dates", () => {
    expect(buildEcran({ ecran: "rapports", periode: "mois", section: "Meilleures ventes" }, catalog, all)).toEqual({
      ok: true,
      ecran: { ecran: "rapports", url: "/rapports?periode=mois", cible: "rapports.chiffre", titre: "Rapports", section: "Meilleures ventes" },
    });
    expect(buildEcran({ ecran: "rapports", periode: "dates", du: "2026-11-03" }, catalog, all)).toMatchObject({
      ecran: { url: "/rapports?periode=dates&du=2026-11-03&au=2026-11-03" },
    });
    expect(buildEcran({ ecran: "rapports" }, catalog, all)).toMatchObject({ ecran: { url: "/rapports" } });
  });
  it("filters the sales by dates, category, state, payment and search", () => {
    expect(
      buildEcran({ ecran: "ventes", periode: "dates", du: "2026-11-01", au: "2026-11-10", categorie: "ciment", paiement: "wave", etat: "payees", recherche: "Awa" }, catalog, all),
    ).toMatchObject({ ok: true, ecran: { url: "/ventes?periode=dates&du=2026-11-01&au=2026-11-10&categorie=k1&etat=payees&paiement=wave&q=Awa" } });
    expect(buildEcran({ ecran: "ventes", periode: "mois_dernier" }, catalog, all)).toMatchObject({ ecran: { url: "/ventes?periode=mois-dernier" } });
  });
  it("maps each list's own state parameter", () => {
    expect(buildEcran({ ecran: "historique_stock", etat: "out", recherche: "riz", periode: "tout" }, catalog, all)).toMatchObject({
      ecran: { url: "/stock/historique?periode=tout&type=out&q=riz" },
    });
    expect(buildEcran({ ecran: "commandes", etat: "delivered" }, catalog, all)).toMatchObject({ ecran: { url: "/commandes?filtre=delivered" } });
    expect(buildEcran({ ecran: "produits", categorie: "peinture", etat: "bas" }, catalog, all)).toMatchObject({ ecran: { url: "/produits?etat=bas&categorie=k2" } });
  });
  it("tells which filters a page could not take", () => {
    expect(buildEcran({ ecran: "rapports", etat: "credit", paiement: "wave" }, catalog, all)).toMatchObject({
      ok: true,
      remarques: ["État « credit » inconnu ici.", "Le filtre de paiement ne vaut que pour les ventes (cash, wave, orange_money, credit)."],
    });
  });
  it("refuses an unknown category with the list of categories", () => {
    expect(buildEcran({ ecran: "ventes", categorie: "jouets" }, catalog, all)).toEqual({
      ok: false,
      reason: "Catégorie introuvable : « jouets ».",
      candidates: ["Ciment et liants", "Peinture"],
    });
  });
  it("opens the new pages: categories, past inventories, quotes, a supplier, my account", () => {
    expect(buildEcran({ ecran: "inventaires_passes" }, catalog, all)).toMatchObject({ ecran: { url: "/stock/inventaire?onglet=historique" } });
    expect(buildEcran({ ecran: "devis" }, catalog, all)).toMatchObject({ ecran: { url: "/factures?onglet=devis" } });
    expect(buildEcran({ ecran: "categories" }, catalog, { ...all, products: false })).toEqual({ ok: false, reason: "Tu n'as pas accès aux produits." });
    expect(buildEcran({ ecran: "fournisseur", nom: "sococim" }, catalog, all)).toMatchObject({ ecran: { url: "/fournisseurs/f1", titre: "Sococim Distribution" } });
    expect(buildEcran({ ecran: "mon_compte" }, catalog, all)).toMatchObject({ ecran: { url: "/mon-compte" } });
  });
  it("refuses what the user cannot open, or a missing name", () => {
    expect(buildEcran({ ecran: "commandes" }, catalog, { ...all, orders: false })).toEqual({ ok: false, reason: "Tu n'as pas accès aux commandes." });
    expect(buildEcran({ ecran: "client" }, catalog, all)).toEqual({ ok: false, reason: "Dis le nom du client." });
    expect(buildEcran({ ecran: "client", nom: "fatou" }, catalog, all)).toEqual({ ok: false, reason: "Client introuvable : « fatou »." });
    expect(buildEcran({ ecran: "cuisine" }, catalog, all)).toEqual({ ok: false, reason: "Écran inconnu." });
  });
});

describe("missionForModel", () => {
  it("keeps names and amounts, never ids", () => {
    const text = missionForModel({ type: "tache", tache: { action: "customer", name: "Fatou Sall", phone: "", address: "" } });
    expect(text).toBe('{"action":"nouveau_client","nom":"Fatou Sall","telephone":null,"adresse":null}');
  });
});

describe("buildEcran — toutes les pages", () => {
  it("opens simple pages without a finger", () => {
    expect(buildEcran({ ecran: "fournisseurs" }, catalog, all)).toEqual({ ok: true, ecran: { ecran: "fournisseurs", url: "/fournisseurs", cible: "", titre: "Fournisseurs" } });
    expect(buildEcran({ ecran: "vendre" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/vendre" } });
    expect(buildEcran({ ecran: "inventaire" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/stock/inventaire" } });
    expect(buildEcran({ ecran: "produits" }, catalog, all)).toMatchObject({ ok: true, ecran: { url: "/produits", cible: "produits.liste" } });
  });
  it("respects the access of simple pages", () => {
    expect(buildEcran({ ecran: "clients" }, catalog, { ...all, customers: false })).toEqual({ ok: false, reason: "Tu n'as pas accès aux clients." });
  });
  it("opens the last sale when there is one", () => {
    expect(buildEcran({ ecran: "derniere_vente" }, { ...catalog, derniereVente: { id: "v9", number: "V-0042" } }, all)).toEqual({
      ok: true,
      ecran: { ecran: "derniere_vente", url: "/ventes/v9", cible: "", titre: "Vente V-0042" },
    });
    expect(buildEcran({ ecran: "derniere_vente" }, { ...catalog, derniereVente: null }, all)).toEqual({ ok: false, reason: "Aucune vente enregistrée pour l'instant." });
  });
});

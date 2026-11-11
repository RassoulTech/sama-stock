// src/lib/domain/assistant/drafts.test.ts
import { describe, expect, it } from "vitest";
import { buildDraft, draftForModel, type DraftCatalog } from "./drafts";

const catalog: DraftCatalog = {
  products: [
    { id: "p1", name: "Riz parfumé 1kg", unit: "kg", salePrice: 600, costPrice: 450, available: 40 },
    { id: "p2", name: "Riz brisé", unit: "kg", salePrice: 400, costPrice: 300, available: 10 },
    { id: "p3", name: "Huile Dinor 1L", unit: "litre", salePrice: 1300, costPrice: 1100, available: 1 },
  ],
  customers: [
    { id: "c1", name: "Awa Ndiaye", phone: "+221771234567" },
    { id: "c2", name: "Moussa Diop", phone: null },
  ],
  suppliers: [{ id: "s1", name: "Sedima", phone: null }],
};
const noCosts = { costs: false };

describe("buildDraft — vente", () => {
  it("builds a cash sale at catalogue prices, fully paid", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "riz parfume", quantite: 2 }, { produit: "huile", quantite: 1 }], paiement: "cash" }, catalog, noCosts);
    expect(res.ok).toBe(true);
    if (!res.ok || res.draft.action !== "sale") throw new Error("vente attendue");
    expect(res.draft.total).toBe(2500);
    expect(res.draft.payload).toEqual({
      items: [{ productId: "p1", quantity: 2 }, { productId: "p3", quantity: 1 }],
      paymentMethod: "cash",
      customerId: null,
      amountReceived: 2500,
    });
  });
  it("sends a negotiated price only when it is said", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "riz parfume", quantite: 2, prix_unitaire: 550 }], paiement: "wave" }, catalog, noCosts);
    if (!res.ok || res.draft.action !== "sale") throw new Error("vente attendue");
    expect(res.draft.total).toBe(1100);
    expect(res.draft.payload.items).toEqual([{ productId: "p1", quantity: 2, unitPrice: 550 }]);
  });
  it("refuses an ambiguous product and lists the candidates", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "riz", quantite: 1 }], paiement: "cash" }, catalog, noCosts);
    expect(res).toEqual({ ok: false, reason: "Plusieurs produits correspondent à « riz ».", candidates: ["Riz parfumé 1kg", "Riz brisé"] });
  });
  it("refuses an unknown product", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "sucre", quantite: 1 }], paiement: "cash" }, catalog, noCosts);
    expect(res).toEqual({ ok: false, reason: "Produit introuvable : « sucre »." });
  });
  it("requires a customer for a credit sale", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "riz brise", quantite: 1 }], paiement: "credit" }, catalog, noCosts);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toContain("crédit");
  });
  it("links a credit sale to the customer, nothing received", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "riz brise", quantite: 1 }], paiement: "credit", client: "awa" }, catalog, noCosts);
    if (!res.ok || res.draft.action !== "sale") throw new Error("vente attendue");
    expect(res.draft.payload.customerId).toBe("c1");
    expect(res.draft.payload.amountReceived).toBe(0);
    expect(res.draft.customer).toEqual({ id: "c1", name: "Awa Ndiaye" });
  });
  it("refuses a partial payment without customer", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "riz parfume", quantite: 2 }], paiement: "cash", montant_recu: 1000 }, catalog, noCosts);
    expect(res.ok).toBe(false);
  });
  it("flags a quantity above the available stock", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "huile", quantite: 3 }], paiement: "cash" }, catalog, noCosts);
    if (!res.ok || res.draft.action !== "sale") throw new Error("vente attendue");
    expect(res.draft.lines[0].short).toBe(true);
  });
  it("refuses invalid arguments", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "huile", quantite: 1 }], paiement: "bitcoin" }, catalog, noCosts);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toContain("invalides");
  });
  it("treats null optional values as absent", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "riz parfume", quantite: 2, prix_unitaire: null }], paiement: "cash", client: null, montant_recu: null }, catalog, noCosts);
    if (!res.ok || res.draft.action !== "sale") throw new Error("vente attendue");
    expect(res.draft.total).toBe(1200);
    expect(res.draft.payload).toEqual({ items: [{ productId: "p1", quantity: 2 }], paymentMethod: "cash", customerId: null, amountReceived: 1200 });
  });
});

describe("buildDraft — entrée de stock", () => {
  it("ignores the purchase price for a role without costs", () => {
    const res = buildDraft("brouillon_entree_stock", { lignes: [{ produit: "riz parfume", quantite: 10, prix_achat: 450 }] }, catalog, noCosts);
    if (!res.ok || res.draft.action !== "purchase") throw new Error("entrée attendue");
    expect(res.draft.payload).toEqual({ items: [{ productId: "p1", quantity: 10 }], supplierId: null });
    expect(res.draft.total).toBeNull();
    expect(res.draft.lines[0].unitPrice).toBeNull();
  });
  it("keeps the purchase price and supplier for a role with costs", () => {
    const res = buildDraft("brouillon_entree_stock", { lignes: [{ produit: "riz parfume", quantite: 10, prix_achat: 450 }], fournisseur: "sedima" }, catalog, { costs: true });
    if (!res.ok || res.draft.action !== "purchase") throw new Error("entrée attendue");
    expect(res.draft.payload).toEqual({ items: [{ productId: "p1", quantity: 10, unitCost: 450 }], supplierId: "s1" });
    expect(res.draft.total).toBe(4500);
  });
  it("ignores a null purchase price", () => {
    const res = buildDraft("brouillon_entree_stock", { lignes: [{ produit: "riz parfume", quantite: 10, prix_achat: null }], fournisseur: null }, catalog, { costs: true });
    if (!res.ok || res.draft.action !== "purchase") throw new Error("entrée attendue");
    expect(res.draft.payload).toEqual({ items: [{ productId: "p1", quantity: 10 }], supplierId: null });
    expect(res.draft.total).toBeNull();
  });
});

describe("buildDraft — commande et paiement", () => {
  it("builds an order with delivery fee", () => {
    const res = buildDraft("brouillon_commande", { client: "Moussa", canal: "whatsapp", lignes: [{ produit: "riz brise", quantite: 3 }], frais_livraison: 1000 }, catalog, noCosts);
    if (!res.ok || res.draft.action !== "order") throw new Error("commande attendue");
    expect(res.draft.total).toBe(2200);
    expect(res.draft.payload).toEqual({
      customerId: "c2",
      channel: "whatsapp",
      items: [{ productId: "p2", quantity: 3 }],
      deliveryFee: 1000,
      deliveryAddress: "",
      amountPaid: 0,
      paymentMethod: null,
    });
  });
  it("refuses an advance when the payment method is not said", () => {
    const res = buildDraft("brouillon_commande", { client: "Moussa", canal: "whatsapp", lignes: [{ produit: "riz brise", quantite: 3 }], montant_paye: 1000 }, catalog, noCosts);
    expect(res).toEqual({ ok: false, reason: "Dis comment le client a payé l'avance : espèces, Wave ou Orange Money." });
  });
  it("keeps the advance and its method, and tells the model about them", () => {
    const res = buildDraft(
      "brouillon_commande",
      { client: "Moussa", canal: "whatsapp", lignes: [{ produit: "riz brise", quantite: 3 }], montant_paye: 1000, paiement: "wave", adresse: "Médina" },
      catalog,
      noCosts,
    );
    if (!res.ok || res.draft.action !== "order") throw new Error("commande attendue");
    expect(res.draft.payload.amountPaid).toBe(1000);
    expect(res.draft.payload.paymentMethod).toBe("wave");
    expect(draftForModel(res.draft)).toMatchObject({ montant_paye: 1000, paiement: "wave", adresse: "Médina" });
  });
  it("finds the paying customer by phone", () => {
    const res = buildDraft("brouillon_paiement_client", { client: "77 123 45 67", montant: 5000, paiement: "wave" }, catalog, noCosts);
    if (!res.ok || res.draft.action !== "payment") throw new Error("paiement attendu");
    expect(res.draft.payload).toEqual({ customerId: "c1", amount: 5000, method: "wave" });
  });
});

describe("draftForModel", () => {
  it("shows names and amounts, never internal ids", () => {
    const res = buildDraft("brouillon_vente", { lignes: [{ produit: "riz parfume", quantite: 2 }], paiement: "cash", client: "awa" }, catalog, noCosts);
    if (!res.ok) throw new Error("brouillon attendu");
    const json = JSON.stringify(draftForModel(res.draft));
    expect(json).toContain("Riz parfumé 1kg");
    expect(json).toContain("Awa Ndiaye");
    expect(json).not.toMatch(/"p1"|"c1"/);
  });
});

const wide: DraftCatalog = {
  ...catalog,
  customers: [
    { id: "c1", name: "Awa Ndiaye", phone: "+221771234567", debt: 8000 },
    { id: "c2", name: "Moussa Diop", phone: null, debt: 0 },
  ],
  categories: [{ id: "k1", name: "Céréales" }],
  openOrders: [
    { id: "o1", number: "CMD-0012", customerName: "Awa Ndiaye", status: "shipping" },
    { id: "o2", number: "CMD-0013", customerName: "Moussa Diop", status: "new" },
  ],
};
const withCosts = { costs: true };

describe("buildDraft — sortie de stock", () => {
  it("turns a breakage into a loss", () => {
    const res = buildDraft("brouillon_sortie_stock", { produit: "huile", quantite: 1, motif: "breakage" }, wide, noCosts);
    expect(res).toEqual({
      ok: true,
      draft: {
        action: "stock_exit",
        product: { id: "p3", name: "Huile Dinor 1L", unit: "litre", available: 1 },
        quantity: 1,
        kind: "loss",
        reason: "breakage",
        reasonLabel: "Casse",
        note: "",
      },
    });
  });
  it("turns a gift into an exit", () => {
    const res = buildDraft("brouillon_sortie_stock", { produit: "riz brisé", quantite: 2, motif: "gift", note: "pour la tantie" }, wide, noCosts);
    if (!res.ok || res.draft.action !== "stock_exit") throw new Error("sortie attendue");
    expect(res.draft.kind).toBe("exit");
    expect(res.draft.note).toBe("pour la tantie");
  });
  it("refuses an unknown reason", () => {
    expect(buildDraft("brouillon_sortie_stock", { produit: "huile", quantite: 1, motif: "fete" }, wide, noCosts).ok).toBe(false);
  });
});

describe("buildDraft — état d'une commande", () => {
  it("finds the order by customer and checks the transition", () => {
    const res = buildDraft("brouillon_statut_commande", { commande: "awa", etat: "delivered" }, wide, noCosts);
    expect(res).toEqual({
      ok: true,
      draft: { action: "order_status", order: { id: "o1", number: "CMD-0012", customerName: "Awa Ndiaye" }, from: "shipping", to: "delivered", label: "Marquer livrée" },
    });
  });
  it("finds the order by its number", () => {
    const res = buildDraft("brouillon_statut_commande", { commande: "13", etat: "preparing" }, wide, noCosts);
    if (!res.ok || res.draft.action !== "order_status") throw new Error("état attendu");
    expect(res.draft.order.id).toBe("o2");
  });
  it("refuses a forbidden transition", () => {
    const res = buildDraft("brouillon_statut_commande", { commande: "moussa", etat: "delivered" }, wide, noCosts);
    expect(res).toEqual({ ok: false, reason: "La commande CMD-0013 est « Nouvelle » : elle ne peut pas passer à « Livrée »." });
  });
  it("refuses an unknown order", () => {
    expect(buildDraft("brouillon_statut_commande", { commande: "fatou", etat: "delivered" }, wide, noCosts)).toEqual({
      ok: false,
      reason: "Commande en cours introuvable : « fatou ».",
    });
  });
});

describe("buildDraft — nouveau produit et prix", () => {
  it("prepares a new product in an existing category", () => {
    const res = buildDraft("brouillon_produit", { nom: "Mil 1kg", prix_vente: 700, prix_achat: 500, unite: "kg", categorie: "cereales", stock_initial: 20 }, wide, withCosts);
    expect(res).toEqual({
      ok: true,
      draft: { action: "product", name: "Mil 1kg", unit: "kg", salePrice: 700, costPrice: 500, category: { id: "k1", name: "Céréales" }, initialStock: 20, reference: "" },
    });
  });
  it("creates a new category name and hides the cost without the right", () => {
    const res = buildDraft("brouillon_produit", { nom: "Savon Madar", prix_vente: 250, prix_achat: 180, categorie: "Hygiène" }, wide, noCosts);
    if (!res.ok || res.draft.action !== "product") throw new Error("produit attendu");
    expect(res.draft.category).toEqual({ id: null, name: "Hygiène" });
    expect(res.draft.costPrice).toBeNull();
    expect(res.draft.unit).toBe("piece");
  });
  it("refuses a product that already exists", () => {
    expect(buildDraft("brouillon_produit", { nom: "riz brise", prix_vente: 400 }, wide, noCosts)).toEqual({ ok: false, reason: "Le produit « Riz brisé » existe déjà." });
  });
  it("prepares a new sale price", () => {
    const res = buildDraft("brouillon_prix", { produit: "huile", prix_vente: 1400 }, wide, noCosts);
    expect(res).toEqual({ ok: true, draft: { action: "price", product: { id: "p3", name: "Huile Dinor 1L" }, oldSalePrice: 1300, salePrice: 1400, costPrice: null } });
  });
  it("refuses a price change without any price", () => {
    expect(buildDraft("brouillon_prix", { produit: "huile" }, wide, noCosts).ok).toBe(false);
  });
});

describe("buildDraft — fiches client et fournisseur", () => {
  it("prepares a new customer", () => {
    expect(buildDraft("brouillon_client", { nom: "Fatou Sall", telephone: "77 123 45 67" }, wide, noCosts)).toEqual({
      ok: true,
      draft: { action: "customer", name: "Fatou Sall", phone: "77 123 45 67", address: "" },
    });
  });
  it("refuses a customer that already exists", () => {
    expect(buildDraft("brouillon_client", { nom: "awa ndiaye" }, wide, noCosts)).toEqual({ ok: false, reason: "Le client « Awa Ndiaye » existe déjà." });
  });
  it("prepares a new supplier", () => {
    expect(buildDraft("brouillon_fournisseur", { nom: "Senico", note: "livre le lundi" }, wide, noCosts)).toEqual({
      ok: true,
      draft: { action: "supplier", name: "Senico", phone: "", note: "livre le lundi" },
    });
  });
});

describe("buildDraft — remboursement et dette", () => {
  it("refuses a payment from a customer who owes nothing", () => {
    expect(buildDraft("brouillon_paiement_client", { client: "moussa", montant: 1000, paiement: "cash" }, wide, noCosts)).toEqual({ ok: false, reason: "Moussa Diop ne doit rien." });
  });
  it("refuses a payment above the debt", () => {
    expect(buildDraft("brouillon_paiement_client", { client: "awa", montant: 9000, paiement: "wave" }, wide, noCosts)).toEqual({
      ok: false,
      reason: "Awa Ndiaye doit seulement 8000 francs.",
    });
  });
});

describe("draftForModel — nouvelles tâches", () => {
  it("describes a stock exit without ids", () => {
    const res = buildDraft("brouillon_sortie_stock", { produit: "huile", quantite: 1, motif: "breakage" }, wide, noCosts);
    if (!res.ok) throw new Error("sortie attendue");
    expect(draftForModel(res.draft)).toEqual({ action: "sortie_stock", produit: "Huile Dinor 1L", quantite: 1, unite: "litre", motif: "Casse", note: null });
  });
});

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

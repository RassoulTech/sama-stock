import { describe, expect, it } from "vitest";
import { notifyPrefs, orderMessage, receivesNotifications, saleCancelMessage, saleMessage, stockCrossing, stockMessage } from "./notifications";

describe("alertes de stock", () => {
  it("prévient une seule fois, au passage du seuil", () => {
    expect(stockCrossing(10, 4, 5)).toBe("stock_low");
    expect(stockCrossing(4, 3, 5)).toBeNull();
    expect(stockCrossing(3, 0, 5)).toBe("stock_out");
    expect(stockCrossing(10, 0, 5)).toBe("stock_out");
    expect(stockCrossing(0, -2, 5)).toBeNull();
  });
  it("ne dit rien quand le stock remonte ou reste au-dessus du seuil", () => {
    expect(stockCrossing(2, 8, 5)).toBeNull();
    expect(stockCrossing(20, 12, 5)).toBeNull();
  });
  it("sans seuil, seule la rupture compte", () => {
    expect(stockCrossing(3, 1, 0)).toBeNull();
    expect(stockCrossing(1, 0, 0)).toBe("stock_out");
  });
});

describe("réglages", () => {
  it("active tout par défaut et garde ce qui a été coupé", () => {
    expect(notifyPrefs(null)).toEqual({ sale: true, order: true, stock: true, sound: true });
    expect(notifyPrefs({ sale: false, sound: false })).toEqual({ sale: false, order: true, stock: true, sound: false });
  });
  it("seuls le propriétaire et les gérants sont prévenus", () => {
    expect(receivesNotifications("owner")).toBe(true);
    expect(receivesNotifications("manager")).toBe(true);
    expect(receivesNotifications("seller")).toBe(false);
    expect(receivesNotifications("storekeeper")).toBe(false);
  });
});

describe("textes", () => {
  it("vente", () => {
    const m = saleMessage({ id: "s1", number: "V-0042", total: 12500, itemCount: 3, actorName: "Fatou Ndiaye" });
    expect(m.title).toMatch(/^Vente de 12\s500 FCFA$/);
    expect(m.body).toBe("Fatou · 3 produits · V-0042");
    expect(m.href).toBe("/ventes/s1");
    expect(saleMessage({ id: "s2", number: "V-1", total: 500, itemCount: 1, actorName: "Moussa", offline: true }).body).toBe(
      "Moussa · 1 produit · V-1 · faite sans internet",
    );
  });
  it("commande", () => {
    const m = orderMessage({ id: "o1", number: "C-0007", total: 25000, customerName: "Awa Diop", channel: "whatsapp" });
    expect(m.body).toBe("Awa Diop · WhatsApp · C-0007");
    expect(m.href).toBe("/commandes/o1");
  });
  it("stock", () => {
    expect(stockMessage({ kind: "stock_out", productId: "p1", name: "Savon noir", available: 0, unit: "piece" }).body).toBe("Savon noir : il n'en reste plus");
    const low = stockMessage({ kind: "stock_low", productId: "p2", name: "Ciment 50 kg", available: 3, unit: "sac", locationName: "Dépôt" });
    expect(low.title).toBe("Stock bas");
    expect(low.body).toMatch(/^Ciment 50 kg \(Dépôt\) : plus que 3 /);
  });
});

describe("vente annulée ou corrigée", () => {
  it("annulée : lien vers la vente", () => {
    const m = saleCancelMessage({ id: "s1", number: "V-0042", total: 12500, actorName: "Fatou Ndiaye" });
    expect(m.kind).toBe("sale_cancel");
    expect(m.title).toBe("Vente annulée · V-0042");
    expect(m.body).toContain("Fatou");
    expect(m.href).toBe("/ventes/s1");
  });
  it("corrigée : lien vers la nouvelle vente", () => {
    const m = saleCancelMessage({ id: "s1", number: "V-0042", total: 12500, actorName: "Fatou", replacement: { id: "s2", number: "V-0050" } });
    expect(m.title).toBe("Vente corrigée · V-0042");
    expect(m.body).toContain("remplacée par V-0050");
    expect(m.href).toBe("/ventes/s2");
  });
});

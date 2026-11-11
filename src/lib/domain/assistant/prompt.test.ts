import { describe, expect, it } from "vitest";
import { buildSystemPrompt, MAX_PROMPT_PRODUCTS } from "./prompt";

const base = { businessName: "Boutique Ndiaye", roleLabel: "Vendeur", today: new Date("2026-11-05T10:00:00Z") };

describe("buildSystemPrompt", () => {
  it("names the shop, the role and the date", () => {
    const text = buildSystemPrompt({ ...base, products: [] });
    expect(text).toContain("Boutique Ndiaye");
    expect(text).toContain("Vendeur");
    expect(text).toContain("2026-11-05");
  });
  it("lists the catalogue with price and available quantity", () => {
    const text = buildSystemPrompt({ ...base, products: [{ name: "Riz parfumé 1kg", unit: "kg", salePrice: 600, available: 40 }] });
    expect(text).toContain("- Riz parfumé 1kg — kg — 600 F — 40");
  });
  it("teaches the dërëm amounts and the final tool", () => {
    const text = buildSystemPrompt({ ...base, products: [] });
    expect(text).toContain("dërëm");
    expect(text).toContain("ñaari junni");
    expect(text).toContain("repondre");
  });
  it("asks for the draft and the final answer in the same turn, without amounts", () => {
    const text = buildSystemPrompt({ ...base, products: [] });
    expect(text).toContain("dans le même tour");
    expect(text).toContain("ne répète pas les montants");
  });
  it("answers stock and price questions from the catalogue in one turn, and reads the rest first", () => {
    const text = buildSystemPrompt({ ...base, products: [] });
    expect(text).toContain("Pour le stock ou le prix d'un produit du catalogue, réponds directement");
    expect(text).toContain("Pour les ventes, les dettes et les commandes, appelle d'abord l'outil de lecture");
  });
  it("never leaks a purchase price passed by mistake", () => {
    const products = [{ name: "Savon", unit: "piece", salePrice: 250, available: 3, costPrice: 987654 }];
    expect(buildSystemPrompt({ ...base, products })).not.toContain("987654");
  });
  it("cuts a long catalogue and says how many are left", () => {
    const products = Array.from({ length: MAX_PROMPT_PRODUCTS + 5 }, (_, i) => ({ name: `Produit ${i}`, unit: "piece", salePrice: 100, available: 1 }));
    const text = buildSystemPrompt({ ...base, products });
    expect(text).toContain(`Produit ${MAX_PROMPT_PRODUCTS - 1} —`);
    expect(text).not.toContain(`Produit ${MAX_PROMPT_PRODUCTS} —`);
    expect(text).toContain("… et 5 autres produits");
  });
});

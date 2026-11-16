import { describe, expect, it } from "vitest";
import { NOM_ASSISTANT } from "./nom";
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
  it("explains the screen tasks, the agreement and the single task rule", () => {
    const text = buildSystemPrompt({ ...base, products: [] });
    expect(text).toContain("dans le même tour");
    expect(text).toContain("ne répète pas les montants");
    expect(text).toContain("l'assistant remplit l'écran devant le commerçant puis lui demande s'il peut enregistrer");
    expect(text).toContain("Une seule tâche par demande");
    expect(text).toContain("« montrer_ecran »");
    expect(text).not.toContain("Tu ne peux ni créer de produit");
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
  it("writes conversation rules for the live dialogue", () => {
    const text = buildSystemPrompt({ ...base, products: [], mode: "conversation" });
    expect(text).toContain("Tu parles à voix haute avec le commerçant");
    expect(text).toContain("relance avec une question courte");
    expect(text).toContain("Ne dis jamais « je t'affiche »");
    expect(text).toContain("Ndax ma bind ko ?");
    expect(text).toContain("appelle « confirmer »");
    expect(text).toContain("« lire_ecran »");
    expect(text).toContain("« cliquer »");
    expect(text).toContain("« envoyer_whatsapp »");
    expect(text).not.toContain("repondre");
    expect(text).toContain("(aucun produit enregistré)");
  });
  it("calls the assistant Finch", () => {
    expect(NOM_ASSISTANT).toBe("Finch");
  });
  it("gives the assistant its name in both modes", () => {
    for (const mode of ["note", "conversation"] as const) {
      const text = buildSystemPrompt({ ...base, products: [], mode });
      expect(text).toContain(`Tu t'appelles ${NOM_ASSISTANT}`);
      expect(text).toContain(`Je m'appelle ${NOM_ASSISTANT}`);
      expect(text).toContain(`Maa ngi tudd ${NOM_ASSISTANT}`);
    }
  });
  it("answers to its name and introduces itself when greeted in the live dialogue", () => {
    const text = buildSystemPrompt({ ...base, products: [], mode: "conversation" });
    expect(text).toContain(`t'appelle par ton nom (« ${NOM_ASSISTANT}, … »)`);
    expect(text).toContain("salue");
    expect(text).toContain(`« Bonjour, c'est ${NOM_ASSISTANT}. »`);
  });
});

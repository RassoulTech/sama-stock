import { describe, expect, it } from "vitest";
import { resumeCatalogue } from "./catalogue";

const p = (name: string, available: number, status: "ok" | "low" | "out", salePrice = 1000, costPrice: number | null = 800) => ({ name, available, status, salePrice, costPrice });
const produits = [p("Ciment 50 kg", 57, "ok", 4600, 4100), p("Colle PVC", 0, "out", 2500, 2000), p("Clous de 8", 3, "low", 1300, 900), p("Peinture 4 L", 0, "out", 12000, 9000)];

describe("resumeCatalogue", () => {
  it("counts products, low stock and out of stock, with names", () => {
    expect(resumeCatalogue(produits, { costs: false })).toEqual({
      nombre_produits: 4,
      en_stock: 1,
      stock_bas: 1,
      ruptures: 2,
      produits_stock_bas: ["Clous de 8"],
      produits_en_rupture: ["Colle PVC", "Peinture 4 L"],
      valeur_stock_prix_vente: 57 * 4600 + 3 * 1300,
    });
  });
  it("adds the purchase value only for roles that see costs", () => {
    expect(resumeCatalogue(produits, { costs: true })).toMatchObject({ valeur_stock_prix_achat: 57 * 4100 + 3 * 900 });
  });
  it("keeps the name lists short", () => {
    const beaucoup = Array.from({ length: 12 }, (_, i) => p(`Produit ${i}`, 0, "out"));
    expect(resumeCatalogue(beaucoup, { costs: false }).produits_en_rupture).toHaveLength(8);
  });
});

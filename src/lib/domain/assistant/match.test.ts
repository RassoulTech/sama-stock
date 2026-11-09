import { describe, expect, it } from "vitest";
import { findByName, levenshtein, normalizeName } from "./match";

const products = [
  { id: "p1", name: "Riz parfumé 1kg" },
  { id: "p2", name: "Riz brisé" },
  { id: "p3", name: "Huile Dinor 1L" },
  { id: "p4", name: "Ciment 50kg" },
];
const customers = [
  { id: "c1", name: "Awa Ndiaye", phone: "+221 77 123 45 67" },
  { id: "c2", name: "Awa Diop", phone: "+221 78 000 00 00" },
  { id: "c3", name: "Moussa Sarr", phone: null },
];

describe("normalizeName", () => {
  it("removes accents, case and punctuation", () => {
    expect(normalizeName("Riz Parfumé (1kg)")).toBe("riz parfume 1kg");
    expect(normalizeName("  ÇA   va ! ")).toBe("ca va");
  });
});

describe("normalizeName — ligatures et unités", () => {
  it("maps ligatures", () => {
    expect(normalizeName("Bœuf")).toBe("boeuf");
    expect(normalizeName("Œuf")).toBe("oeuf");
  });
  it("joins numbers to their unit", () => {
    expect(normalizeName("riz 1 kg")).toBe("riz 1kg");
    expect(normalizeName("ciment 50 kilos")).toBe("ciment 50kg");
    expect(normalizeName("sucre 50 kilogrammes")).toBe("sucre 50kg");
    expect(normalizeName("huile 1 litres")).toBe("huile 1l");
    expect(normalizeName("huile 1 l")).toBe("huile 1l");
    expect(normalizeName("poudre 400 grammes")).toBe("poudre 400g");
    expect(normalizeName("poudre 400 gr")).toBe("poudre 400g");
  });
});

describe("findByName — unités dites à l'oral", () => {
  it("finds products by spoken units", () => {
    expect(findByName("riz 1 kg", products)).toEqual({ kind: "one", item: products[0] });
    expect(findByName("ciment 50 kilos", products)).toEqual({ kind: "one", item: products[3] });
    expect(findByName("huile 1 litre", products)).toEqual({ kind: "one", item: products[2] });
  });
  it("still finds nothing for another size", () => {
    expect(findByName("riz 2kg", products)).toEqual({ kind: "none" });
  });
});

describe("levenshtein", () => {
  it("counts single-letter edits", () => {
    expect(levenshtein("ciment", "ciment")).toBe(0);
    expect(levenshtein("siment", "ciment")).toBe(1);
    expect(levenshtein("ciman", "ciment")).toBe(2);
  });
});

describe("findByName", () => {
  it("finds an exact name whatever the accents and case", () => {
    expect(findByName("riz parfume 1kg", products)).toEqual({ kind: "one", item: products[0] });
  });
  it("finds a single product from the start of its words", () => {
    expect(findByName("huile", products)).toEqual({ kind: "one", item: products[2] });
  });
  it("returns every candidate when the name is ambiguous", () => {
    expect(findByName("riz", products)).toEqual({ kind: "many", items: [products[0], products[1]] });
  });
  it("narrows with a second word", () => {
    expect(findByName("riz brise", products)).toEqual({ kind: "one", item: products[1] });
  });
  it("tolerates close spelling mistakes", () => {
    expect(findByName("siment", products)).toEqual({ kind: "one", item: products[3] });
    expect(findByName("ciman", products)).toEqual({ kind: "one", item: products[3] });
  });
  it("returns none for an unknown or empty name", () => {
    expect(findByName("sucre", products)).toEqual({ kind: "none" });
    expect(findByName("  ", products)).toEqual({ kind: "none" });
  });
  it("finds a customer by the end of the phone number", () => {
    expect(findByName("77 123 45 67", customers)).toEqual({ kind: "one", item: customers[0] });
  });
  it("finds a customer by full name, or lists namesakes", () => {
    expect(findByName("awa ndiaye", customers)).toEqual({ kind: "one", item: customers[0] });
    expect(findByName("Awa", customers)).toEqual({ kind: "many", items: [customers[0], customers[1]] });
  });
  it("never guesses a different size or quantity", () => {
    expect(findByName("riz 2kg", products)).toEqual({ kind: "none" });
    expect(findByName("ciment 60kg", products)).toEqual({ kind: "none" });
  });
  it("keeps at most 5 candidates", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, name: `Savon ${i}` }));
    const result = findByName("savon", many);
    expect(result.kind).toBe("many");
    expect(result.kind === "many" && result.items).toHaveLength(5);
  });
});

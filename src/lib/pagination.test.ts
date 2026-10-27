import { describe, expect, it } from "vitest";
import { pageCount, pageHref, pageItems, pageSlice, rangeLabel, readPage } from "./pagination";

describe("pagination", () => {
  it("lit le numéro de page de l'adresse", () => {
    expect(readPage({})).toBe(1);
    expect(readPage({ page: "3" })).toBe(3);
    expect(readPage({ page: "0" })).toBe(1);
    expect(readPage({ page: "-2" })).toBe(1);
    expect(readPage({ page: "2.5" })).toBe(1);
    expect(readPage({ page: "abc" })).toBe(1);
    expect(readPage({ page: ["4", "5"] })).toBe(4);
  });

  it("calcule la tranche et le nombre de pages", () => {
    expect(pageSlice(1, 30)).toEqual({ limit: 30, offset: 0 });
    expect(pageSlice(3, 30)).toEqual({ limit: 30, offset: 60 });
    expect(pageCount(0, 30)).toBe(1);
    expect(pageCount(30, 30)).toBe(1);
    expect(pageCount(31, 30)).toBe(2);
  });

  it("affiche les numéros utiles avec des points de suspension", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(pageItems(1, 12)).toEqual([1, 2, "…", 12]);
    expect(pageItems(12, 12)).toEqual([1, "…", 11, 12]);
    // Un seul numéro manquant : on l'affiche plutôt que « … »
    expect(pageItems(4, 12)).toEqual([1, 2, 3, 4, 5, "…", 12]);
  });

  it("garde les filtres dans l'adresse de la page", () => {
    expect(pageHref("/ventes", { q: "awa", page: "2" }, 3)).toBe("/ventes?q=awa&page=3");
    expect(pageHref("/ventes", { q: "awa", page: "2" }, 1)).toBe("/ventes?q=awa");
    expect(pageHref("/ventes", {}, 1)).toBe("/ventes");
    expect(pageHref("/ventes", { periode: "7j", vide: undefined }, 2)).toBe("/ventes?periode=7j&page=2");
  });

  it("résume la tranche affichée", () => {
    expect(rangeLabel(1, 0, 30)).toBe("0 résultat");
    expect(rangeLabel(2, 245, 30)).toBe("31 à 60 sur 245");
    expect(rangeLabel(9, 245, 30)).toBe("241 à 245 sur 245");
  });
});

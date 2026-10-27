import { describe, expect, it } from "vitest";
import { BRAND_PALETTES, brandCss, brandTheme, contrast, customBrand, dominantColors, normalizeBrand, parseBrand, suggestPalette } from "./brand";

describe("valeur enregistrée", () => {
  it("accepte une palette proposée ou 2 à 3 couleurs libres", () => {
    expect(normalizeBrand("bleu")).toBe("bleu");
    expect(normalizeBrand(" #1D4ED8, #172554 ")).toBe("#1d4ed8,#172554");
    expect(normalizeBrand("#1d4ed8,#172554,#fbbf24")).toBe("#1d4ed8,#172554,#fbbf24");
  });
  it("refuse tout le reste", () => {
    expect(normalizeBrand("rouge;}body{display:none")).toBeNull();
    expect(normalizeBrand("#1d4ed8")).toBeNull();
    expect(normalizeBrand("#fff,#000")).toBeNull();
    expect(normalizeBrand("#1d4ed8,#172554,#fbbf24,#ffffff")).toBeNull();
    expect(normalizeBrand("toString")).toBeNull();
    expect(normalizeBrand(null)).toBeNull();
  });
  it("relit les couleurs libres, avec ou sans couleur de rappel", () => {
    expect(parseBrand("#1d4ed8,#172554")).toEqual({ primary: "#1d4ed8", menu: "#172554", highlight: null });
    expect(customBrand({ primary: "#1D4ED8", menu: "#172554", highlight: "#FBBF24" })).toBe("#1d4ed8,#172554,#fbbf24");
  });
});

describe("couleurs lisibles", () => {
  it("garde les couleurs déjà lisibles", () => {
    const t = brandTheme("bleu");
    expect(t.primary).toBe("#1d4ed8");
    expect(t.sidebar).toBe("#1e3a8a");
    expect(t.adjusted).toBe(false);
  });
  it("assombrit une couleur trop claire pour le texte blanc", () => {
    const t = brandTheme("#fde047,#fef08a");
    expect(t.adjusted).toBe(true);
    expect(contrast(t.primary, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.sidebar, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("rend chaque palette lisible, en clair comme en sombre", () => {
    for (const key of [...Object.keys(BRAND_PALETTES), "#fde047,#fef08a", "#000000,#000000,#000000", "#ffffff,#ffffff"]) {
      const t = brandTheme(key);
      expect(contrast(t.primary, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accentForeground, t.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.highlight, t.sidebar)).toBeGreaterThanOrEqual(3);
      expect(contrast(t.dark, "#101714")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.darkHighlight, "#0c1310")).toBeGreaterThanOrEqual(3);
    }
  });
  it("n'injecte que des codes couleur", () => {
    const css = brandCss("#1d4ed8,#172554,#fbbf24")!;
    expect(css).toContain("--sidebar-primary:#fbbf24");
    expect(css.replace(/#[0-9a-f]{6}/g, "")).not.toMatch(/[#;]\s*[^-:a-z]/);
    expect(brandCss("vert")).toBeNull();
  });
});

describe("couleurs du logo", () => {
  const px = (hex: string, n: number, alpha = 255) => {
    const v = Number.parseInt(hex.slice(1), 16);
    return Array.from({ length: n }, () => [(v >> 16) & 255, (v >> 8) & 255, v & 255, alpha]).flat();
  };
  it("trouve les couleurs les plus présentes, sans le fond blanc ni la transparence", () => {
    const pixels = [...px("#1d4ed8", 600), ...px("#e11d48", 300), ...px("#ffffff", 900), ...px("#00ff00", 500, 0), ...px("#7b6b9a", 5)];
    expect(dominantColors(pixels)).toEqual(["#1d4ed8", "#e11d48"]);
  });
  it("propose principale, menu et rappel", () => {
    expect(suggestPalette(["#1d4ed8", "#e11d48"])).toEqual({ primary: "#1d4ed8", menu: expect.stringMatching(/^#/), highlight: "#e11d48" });
    expect(suggestPalette(["#111111", "#d97706"])).toEqual({ primary: "#d97706", menu: "#111111", highlight: null });
    expect(suggestPalette([])).toBeNull();
  });
});

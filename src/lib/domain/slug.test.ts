import { describe, expect, it } from "vitest";
import { isValidSlug, pickSlug, SLUG_MAX, slugify } from "./slug";

describe("slugify", () => {
  it("transforme le nom d'une boutique en adresse lisible", () => {
    expect(slugify("Quincaillerie Ndiaye & Fils")).toBe("quincaillerie-ndiaye-et-fils");
    expect(slugify("Ndèye Beauté")).toBe("ndeye-beaute");
    expect(slugify("  Awa  Mode — Wax !! ")).toBe("awa-mode-wax");
    expect(slugify("Boutique N°1")).toBe("boutique-n-1");
  });
  it("complète un nom trop court", () => {
    expect(slugify("AB")).toBe("boutique-ab");
    expect(slugify("***")).toBe("boutique-sama");
  });
  it("coupe un nom trop long sans laisser de tiret à la fin", () => {
    const slug = slugify("Grande quincaillerie moderne du marché central de Thiès et environs");
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe("isValidSlug", () => {
  it("accepte une adresse simple", () => {
    expect(isValidSlug("diallo-cosmetiques")).toBe(true);
    expect(isValidSlug("boutique-2")).toBe(true);
  });
  it("refuse majuscules, espaces, tirets en trop et mots réservés", () => {
    expect(isValidSlug("Diallo")).toBe(false);
    expect(isValidSlug("diallo cosmetiques")).toBe(false);
    expect(isValidSlug("diallo--cosmetiques")).toBe(false);
    expect(isValidSlug("-diallo")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("admin")).toBe(false);
  });
});

describe("pickSlug", () => {
  it("garde le nom quand il est libre", () => {
    expect(pickSlug("ndeye-beaute", new Set())).toBe("ndeye-beaute");
  });
  it("ajoute un numéro quand l'adresse est prise", () => {
    expect(pickSlug("ndeye-beaute", new Set(["ndeye-beaute", "ndeye-beaute-2"]))).toBe("ndeye-beaute-3");
  });
  it("évite les mots réservés", () => {
    expect(pickSlug("admin", new Set())).toBe("admin-boutique");
  });
  it("reste dans la longueur maximale avec le numéro", () => {
    const base = "a".repeat(SLUG_MAX);
    const slug = pickSlug(base, new Set([base]));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug.endsWith("-2")).toBe(true);
  });
});

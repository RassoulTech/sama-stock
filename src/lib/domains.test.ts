import { describe, expect, it } from "vitest";
import { crawlScope, legacyRedirect, legacyShopUrl, shopAppUrl, shopSlugFromHost, TRUSTED_ORIGINS } from "./domains";

describe("adresse de chaque boutique", () => {
  it("reconnaît la boutique dans son sous-domaine", () => {
    expect(shopSlugFromHost("keur-fatou.sama-stock.com")).toBe("keur-fatou");
    expect(shopSlugFromHost("Keur-Fatou.SAMA-STOCK.com:443")).toBe("keur-fatou");
  });
  it("ignore le site principal, www, les mots réservés et les autres adresses", () => {
    expect(shopSlugFromHost("sama-stock.com")).toBeNull();
    expect(shopSlugFromHost("www.sama-stock.com")).toBeNull();
    expect(shopSlugFromHost("admin.sama-stock.com")).toBeNull();
    expect(shopSlugFromHost("a.b.sama-stock.com")).toBeNull();
    expect(shopSlugFromHost("sama-stock-one.vercel.app")).toBeNull();
    expect(shopSlugFromHost("localhost:3000")).toBeNull();
    expect(shopSlugFromHost(null)).toBeNull();
  });
  it("donne l'adresse à envoyer au client : sous-domaine en ligne, …/b/nom sur l'ordinateur de développement", () => {
    expect(shopAppUrl("https://sama-stock.com", "quincaillerie-ndiaye")).toBe("https://quincaillerie-ndiaye.sama-stock.com");
    expect(shopAppUrl("https://sama-stock-one.vercel.app", "quincaillerie-ndiaye")).toBe("https://quincaillerie-ndiaye.sama-stock.com");
    expect(shopAppUrl("http://localhost:3000", "quincaillerie-ndiaye")).toBe("http://localhost:3000/b/quincaillerie-ndiaye");
    expect(legacyShopUrl("quincaillerie-ndiaye")).toBe("https://sama-stock-one.vercel.app/b/quincaillerie-ndiaye");
  });
  it("accepte les connexions venant du nouveau domaine, de ses sous-domaines et de l'ancienne adresse", () => {
    expect(TRUSTED_ORIGINS).toEqual(["https://sama-stock.com", "https://*.sama-stock.com", "https://sama-stock-one.vercel.app"]);
  });
});

describe("référencement : une seule adresse dans Google", () => {
  const visitor = { hasSession: false, hasShop: false };
  it("renvoie la vitrine de l'ancienne adresse vers sama-stock.com", () => {
    expect(legacyRedirect("sama-stock-one.vercel.app", "/", visitor)).toBe("https://sama-stock.com");
    expect(legacyRedirect("sama-stock-one.vercel.app", "/conditions", visitor)).toBe("https://sama-stock.com/conditions");
  });
  it("ne touche jamais aux clients déjà installés ni à l'application", () => {
    expect(legacyRedirect("sama-stock-one.vercel.app", "/", { hasSession: true, hasShop: false })).toBeNull();
    expect(legacyRedirect("sama-stock-one.vercel.app", "/", { hasSession: false, hasShop: true })).toBeNull();
    expect(legacyRedirect("sama-stock-one.vercel.app", "/connexion", visitor)).toBeNull();
    expect(legacyRedirect("sama-stock-one.vercel.app", "/b/quincaillerie-ndiaye", visitor)).toBeNull();
    expect(legacyRedirect("sama-stock.com", "/", visitor)).toBeNull();
  });
  it("dit aux moteurs ce qu'ils peuvent explorer selon l'adresse", () => {
    expect(crawlScope("sama-stock.com")).toBe("site");
    expect(crawlScope("sama-stock-one.vercel.app")).toBe("legacy");
    expect(crawlScope("quincaillerie-ndiaye.sama-stock.com")).toBe("none");
    expect(crawlScope("sama-stock-abc123-rassoultechs-projects.vercel.app")).toBe("none");
  });
});

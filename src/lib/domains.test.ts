import { describe, expect, it } from "vitest";
import { legacyShopUrl, shopAppUrl, shopSlugFromHost, TRUSTED_ORIGINS } from "./domains";

describe("adresse de chaque boutique", () => {
  it("reconnaît la boutique dans son sous-domaine", () => {
    expect(shopSlugFromHost("senegal-sanitary.sama-stock.com")).toBe("senegal-sanitary");
    expect(shopSlugFromHost("Senegal-Sanitary.SAMA-STOCK.com:443")).toBe("senegal-sanitary");
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
    expect(shopAppUrl("https://sama-stock.com", "tgi-informatique")).toBe("https://tgi-informatique.sama-stock.com");
    expect(shopAppUrl("https://sama-stock-one.vercel.app", "tgi-informatique")).toBe("https://tgi-informatique.sama-stock.com");
    expect(shopAppUrl("http://localhost:3000", "tgi-informatique")).toBe("http://localhost:3000/b/tgi-informatique");
    expect(legacyShopUrl("tgi-informatique")).toBe("https://sama-stock-one.vercel.app/b/tgi-informatique");
  });
  it("accepte les connexions venant du nouveau domaine, de ses sous-domaines et de l'ancienne adresse", () => {
    expect(TRUSTED_ORIGINS).toEqual(["https://sama-stock.com", "https://*.sama-stock.com", "https://sama-stock-one.vercel.app"]);
  });
});

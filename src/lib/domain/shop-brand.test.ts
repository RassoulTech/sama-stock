import { describe, expect, it } from "vitest";
import { iconLogo, shopColors, shortAppName } from "./shop-brand";

describe("shortAppName", () => {
  it("garde un nom déjà court", () => {
    expect(shortAppName("Ndèye Beauté")).toBe("Ndèye Beauté");
  });
  it("retire les mots génériques du commerce", () => {
    expect(shortAppName("Quincaillerie Ndiaye & Fils")).toBe("Ndiaye Fils");
    expect(shortAppName("Quincaillerie Test Sama")).toBe("Test Sama");
  });
  it("garde les premiers mots qui tiennent", () => {
    expect(shortAppName("Diallo Cosmétiques")).toBe("Diallo");
    expect(shortAppName("Awa Mode & Wax")).toBe("Awa Mode Wax");
  });
  it("coupe un mot unique trop long", () => {
    expect(shortAppName("Supercosmétiquesdakar")).toBe("Supercosmét…");
  });
});

describe("couleurs et logo", () => {
  it("revient au vert Sama Stock pour une couleur inconnue", () => {
    expect(shopColors("inconnue").primary).toBe("#0b6e4f");
    expect(shopColors("bleu").primary).toBe("#1d4ed8");
  });
  it("n'utilise que les logos PNG ou JPEG pour l'icône", () => {
    expect(iconLogo("data:image/jpeg;base64,AAAA")).toBe("data:image/jpeg;base64,AAAA");
    expect(iconLogo("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(iconLogo("data:image/webp;base64,AAAA")).toBeNull();
    expect(iconLogo(null)).toBeNull();
  });
});

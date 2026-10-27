import { describe, expect, it } from "vitest";
import { signDocumentToken, verifyDocumentToken } from "./document-token";
import { amountInWords, amountSentence, dakarYear, documentNumber, quoteDisplayStatus, vatBreakdown } from "./documents";

describe("amountInWords", () => {
  it.each([
    [0, "zéro"],
    [1, "un"],
    [16, "seize"],
    [21, "vingt et un"],
    [71, "soixante et onze"],
    [72, "soixante-douze"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [91, "quatre-vingt-onze"],
    [99, "quatre-vingt-dix-neuf"],
    [100, "cent"],
    [101, "cent un"],
    [200, "deux cents"],
    [280, "deux cent quatre-vingts"],
    [1000, "mille"],
    [1500, "mille cinq cents"],
    [2000, "deux mille"],
    [80_000, "quatre-vingt mille"],
    [200_000, "deux cent mille"],
    [125_300, "cent vingt-cinq mille trois cents"],
    [1_000_000, "un million"],
    [2_750_000, "deux millions sept cent cinquante mille"],
    [80_000_000, "quatre-vingts millions"],
    [1_000_000_001, "un milliard un"],
  ])("%i → %s", (n, words) => {
    expect(amountInWords(n)).toBe(words);
  });

  it("phrase finale de la facture, du devis et du reçu", () => {
    expect(amountSentence("facture", 75_000, "75 000")).toBe(
      "Arrêtée la présente facture à la somme de Soixante-quinze mille (75 000) francs CFA.",
    );
    expect(amountSentence("devis", 100, "100")).toBe("Arrêté le présent devis à la somme de Cent (100) francs CFA.");
    expect(amountSentence("recu", 1, "1")).toMatch(/^Arrêté le présent reçu/);
  });
});

describe("vatBreakdown", () => {
  it("sans TVA : HT = TTC", () => {
    const b = vatBreakdown([{ lineTotal: 10_000 }, { lineTotal: 5_000 }], 1_000, 2_000, 0);
    expect(b).toEqual({ linesHT: [10_000, 5_000], discountHT: 1_000, deliveryHT: 2_000, totalHT: 16_000, vat: 0, totalTTC: 16_000 });
  });

  it("TVA 18 % : le TTC reste exact et HT + TVA = TTC", () => {
    const b = vatBreakdown([{ lineTotal: 11_800 }, { lineTotal: 999 }, { lineTotal: 1 }], 500, 1_000, 18);
    expect(b.linesHT).toEqual([10_000, 847, 1]);
    expect(b.totalTTC).toBe(13_300);
    expect(b.totalHT).toBe(10_000 + 847 + 1 - 424 + 847);
    expect(b.totalHT + b.vat).toBe(b.totalTTC);
  });
});

describe("numéros et statuts", () => {
  it("numéros sur 4 chiffres", () => {
    expect(documentNumber("facture", 2026, 7)).toBe("FAC-2026-0007");
    expect(documentNumber("devis", 2027, 12345)).toBe("DEV-2027-12345");
  });

  it("l'année change à minuit à Dakar (UTC+0)", () => {
    expect(dakarYear(new Date("2026-12-31T23:59:00Z"))).toBe(2026);
    expect(dakarYear(new Date("2027-01-01T00:01:00Z"))).toBe(2027);
  });

  it("un devis en cours dont la validité est passée est expiré", () => {
    const now = new Date("2026-10-26T12:00:00Z");
    expect(quoteDisplayStatus("en_cours", new Date("2026-10-25T00:00:00Z"), now)).toBe("expire");
    expect(quoteDisplayStatus("en_cours", new Date("2026-11-10T00:00:00Z"), now)).toBe("en_cours");
    expect(quoteDisplayStatus("accepte", new Date("2026-10-25T00:00:00Z"), now)).toBe("accepte");
    expect(quoteDisplayStatus("converti", null, now)).toBe("converti");
  });
});

describe("jeton des liens publics", () => {
  const secret = "secret-de-test";
  const id = "3a98e720-97da-49b4-897b-aa36dd00a73b";

  it("un jeton signé se vérifie", () => {
    const token = signDocumentToken(secret, "facture", id);
    expect(token).toMatch(/^f\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{22}$/);
    expect(verifyDocumentToken(secret, token)).toEqual({ kind: "facture", id });
  });

  it("refuse un jeton modifié, d'un autre type ou d'une autre clé", () => {
    const token = signDocumentToken(secret, "recu", id);
    expect(verifyDocumentToken(secret, token.replace(/^r/, "f"))).toBeNull();
    expect(verifyDocumentToken(secret, token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(verifyDocumentToken("autre-secret", token)).toBeNull();
    expect(verifyDocumentToken(secret, "n'importe quoi")).toBeNull();
    expect(verifyDocumentToken(secret, `${token}.x`)).toBeNull();
  });

  it("signe aussi la facture et le devis d'une licence, sans confusion avec ceux d'une boutique", () => {
    const token = signDocumentToken(secret, "licence_facture", id);
    expect(token).toMatch(/^lf./);
    expect(verifyDocumentToken(secret, token)).toEqual({ kind: "licence_facture", id });
    expect(verifyDocumentToken(secret, signDocumentToken(secret, "licence_devis", id))).toEqual({ kind: "licence_devis", id });
    // Changer « lf » en « f » ne donne pas une facture de boutique valable
    expect(verifyDocumentToken(secret, token.replace(/^lf/, "f"))).toBeNull();
  });
});

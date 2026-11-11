import { describe, expect, it } from "vitest";
import { decouperPhrases, fichierPhrase, PHRASES } from "./phrases";

describe("phrases prêtes", () => {
  it("has a wolof and a french text for each key, and a file path", () => {
    for (const [cle, phrase] of Object.entries(PHRASES)) {
      expect(phrase.wo.length).toBeGreaterThan(2);
      expect(phrase.fr.length).toBeGreaterThan(2);
      expect(fichierPhrase(cle as keyof typeof PHRASES)).toBe(`/assistant/voix/${cle}.wav`);
    }
    expect(PHRASES["je-peux-enregistrer"].wo).toBe("Ndax ma bind ko ?");
  });
});

describe("decouperPhrases", () => {
  it("splits on sentence ends and keeps the punctuation", () => {
    expect(decouperPhrases("Tay am nga 12 jaay. Xaalis bi 45 000 francs la ! Jërëjëf ?")).toEqual(["Tay am nga 12 jaay.", "Xaalis bi 45 000 francs la !", "Jërëjëf ?"]);
  });
  it("glues very short pieces to the previous sentence", () => {
    expect(decouperPhrases("Waaw. Bind naa ko ci kàrt bi.")).toEqual(["Waaw. Bind naa ko ci kàrt bi."]);
  });
  it("returns the whole text when there is no sentence end", () => {
    expect(decouperPhrases("  Mii ngi nii  ")).toEqual(["Mii ngi nii"]);
    expect(decouperPhrases("   ")).toEqual([]);
  });
});

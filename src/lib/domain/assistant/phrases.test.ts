import { describe, expect, it } from "vitest";
import { PHRASES } from "./phrases";

describe("phrases du parcours", () => {
  it("has a wolof and a french text for each key", () => {
    for (const phrase of Object.values(PHRASES)) {
      expect(phrase.wo.length).toBeGreaterThan(2);
      expect(phrase.fr.length).toBeGreaterThan(2);
    }
    expect(PHRASES["je-peux-enregistrer"].wo).toBe("Ndax ma bind ko ?");
  });
});

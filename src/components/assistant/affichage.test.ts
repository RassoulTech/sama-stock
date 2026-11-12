import { describe, expect, it } from "vitest";
import { choisirAffichage } from "./affichage";

const base = { actif: true, plein: true, phase: "ecoute" as const, geste: false, message: false };

describe("choisirAffichage", () => {
  it("fills the screen while talking", () => {
    for (const phase of ["connexion", "ecoute", "parle", "outil"] as const) expect(choisirAffichage({ ...base, phase })).toBe("plein");
  });
  it("shrinks to the bubble while a task runs on the screen", () => {
    expect(choisirAffichage({ ...base, phase: "pilote" })).toBe("bulle");
    expect(choisirAffichage({ ...base, phase: "confirmation" })).toBe("bulle");
    expect(choisirAffichage({ ...base, geste: true })).toBe("bulle");
  });
  it("stays in the bubble once reduced", () => {
    expect(choisirAffichage({ ...base, plein: false })).toBe("bulle");
  });
  it("shows only a pending message once the conversation is over", () => {
    expect(choisirAffichage({ ...base, actif: false })).toBe("rien");
    expect(choisirAffichage({ ...base, actif: false, message: true })).toBe("bulle");
  });
});

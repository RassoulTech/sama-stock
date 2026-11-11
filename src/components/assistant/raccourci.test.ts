import { describe, expect, it } from "vitest";
import { estFermetureAssistant, estRaccourciAssistant, type Touche } from "./raccourci";

const touche = (t: Partial<Touche>): Touche => ({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, code: "", key: "", repeat: false, ...t });

describe("estRaccourciAssistant", () => {
  it("recognises Ctrl + Space, by key position or by character", () => {
    expect(estRaccourciAssistant(touche({ ctrlKey: true, code: "Space", key: " " }))).toBe(true);
    expect(estRaccourciAssistant(touche({ ctrlKey: true, key: " " }))).toBe(true);
  });
  it("ignores Space alone, Cmd + Space (Spotlight), Alt + Space and other combinations", () => {
    expect(estRaccourciAssistant(touche({ code: "Space", key: " " }))).toBe(false);
    expect(estRaccourciAssistant(touche({ metaKey: true, code: "Space", key: " " }))).toBe(false);
    expect(estRaccourciAssistant(touche({ ctrlKey: true, altKey: true, code: "Space", key: " " }))).toBe(false);
    expect(estRaccourciAssistant(touche({ ctrlKey: true, shiftKey: true, code: "Space", key: " " }))).toBe(false);
    expect(estRaccourciAssistant(touche({ ctrlKey: true, code: "KeyS", key: "s" }))).toBe(false);
  });
  it("does not fire again while the keys stay pressed", () => {
    expect(estRaccourciAssistant(touche({ ctrlKey: true, code: "Space", key: " ", repeat: true }))).toBe(false);
  });
});

describe("estFermetureAssistant", () => {
  it("recognises Escape alone", () => {
    expect(estFermetureAssistant(touche({ key: "Escape", code: "Escape" }))).toBe(true);
    expect(estFermetureAssistant(touche({ key: "Escape", ctrlKey: true }))).toBe(false);
    expect(estFermetureAssistant(touche({ key: "Enter" }))).toBe(false);
  });
});

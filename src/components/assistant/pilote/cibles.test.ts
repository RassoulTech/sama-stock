import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CIBLES } from "./cibles";
import { MISSIONS_EXEMPLES } from "./exemples";
import { etapesPour } from "./recettes";

const listee = (cible: string) => CIBLES.some((c) => (c.cible.endsWith(".") ? cible.startsWith(c.cible) : cible === c.cible));

describe("contrat des cibles de l'assistant", () => {
  it("lists every target that a recipe points at", () => {
    for (const mission of MISSIONS_EXEMPLES) {
      for (const etape of etapesPour(mission)) {
        const cible = "cible" in etape ? etape.cible : null;
        if (cible) expect(listee(cible), cible).toBe(true);
      }
    }
  });
  it("finds every listed target in its screen", () => {
    for (const { cible, fichier, motif } of CIBLES) {
      expect(readFileSync(fichier, "utf8").includes(motif), `${cible} absent de ${fichier}`).toBe(true);
    }
  });
});

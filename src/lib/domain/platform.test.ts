import { describe, expect, it } from "vitest";
import { NEON_FREE_STORAGE_BYTES, storageAlert, storageLevel } from "./platform";

const GB = NEON_FREE_STORAGE_BYTES;

describe("place dans la base", () => {
  it("est normale sous 70 %, à surveiller de 70 à 90 %, urgente au-delà", () => {
    expect(storageLevel(0.04 * GB)).toBe("ok");
    expect(storageLevel(0.7 * GB)).toBe("attention");
    expect(storageLevel(0.9 * GB)).toBe("urgent");
  });
  it("prévient seulement à partir de 70 %", () => {
    expect(storageAlert(0.5 * GB)).toBeNull();
    expect(storageAlert(0.72 * GB)).toBe("Base de données remplie à 72 % de l'offre gratuite : prévoyez l'offre payante de Neon.");
    expect(storageAlert(0.95 * GB)).toContain("presque pleine : 95 %");
  });
});

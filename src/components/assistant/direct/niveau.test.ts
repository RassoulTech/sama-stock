import { describe, expect, it } from "vitest";
import { niveauSonore } from "./niveau";

const sinus = (amplitude: number) => Float32Array.from({ length: 1024 }, (_, i) => amplitude * Math.sin(i / 5));

describe("niveauSonore", () => {
  it("is 0 for silence or an empty block", () => {
    expect(niveauSonore(new Float32Array(0))).toBe(0);
    expect(niveauSonore(new Float32Array(512))).toBe(0);
    expect(niveauSonore(sinus(0.001))).toBe(0);
  });
  it("grows with the voice and stays at most 1", () => {
    const faible = niveauSonore(sinus(0.02));
    const forte = niveauSonore(sinus(0.3));
    expect(faible).toBeGreaterThan(0);
    expect(forte).toBeGreaterThan(faible);
    expect(niveauSonore(sinus(1))).toBe(1);
  });
});

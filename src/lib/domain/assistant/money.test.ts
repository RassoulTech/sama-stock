// src/lib/domain/assistant/money.test.ts
import { describe, expect, it } from "vitest";
import { lineTotal } from "./money";

describe("lineTotal", () => {
  it("multiplies and rounds to the franc", () => {
    expect(lineTotal(2, 600)).toBe(1200);
    expect(lineTotal(1.5, 600)).toBe(900);
    expect(lineTotal(0.333, 1000)).toBe(333);
  });
});

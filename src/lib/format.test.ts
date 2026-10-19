import { describe, expect, it } from "vitest";
import {
  formatFCFA,
  formatPhone,
  formatQty,
  normalizePhone,
  unitAllowsDecimals,
} from "./format";

const NNBSP = " ";

describe("formatFCFA", () => {
  it("groups thousands with a narrow no-break space", () => {
    expect(formatFCFA(12500)).toBe(`12${NNBSP}500 FCFA`);
  });
  it("rounds to integer francs", () => {
    expect(formatFCFA(999.6)).toBe("1" + NNBSP + "000 FCFA");
  });
  it("handles zero and negatives", () => {
    expect(formatFCFA(0)).toBe("0 FCFA");
    expect(formatFCFA(-2500)).toBe(`-2${NNBSP}500 FCFA`);
  });
});

describe("formatQty", () => {
  it("prints integers without decimals", () => {
    expect(formatQty(3, "sac")).toBe("3 sacs");
  });
  it("uses a comma for decimals and keeps at most 3", () => {
    expect(formatQty(2.5, "m")).toBe("2,5 m");
    expect(formatQty(1.23456, "kg")).toBe("1,235 kg");
  });
  it("singular for 1 or less", () => {
    expect(formatQty(1, "piece")).toBe("1 pièce");
    expect(formatQty(0, "piece")).toBe("0 pièce");
  });
  it("without a unit, prints the number only", () => {
    expect(formatQty(12)).toBe("12");
  });
});

describe("unitAllowsDecimals", () => {
  it("accepts decimals for measurable units only", () => {
    expect(unitAllowsDecimals("kg")).toBe(true);
    expect(unitAllowsDecimals("m")).toBe(true);
    expect(unitAllowsDecimals("sac")).toBe(false);
    expect(unitAllowsDecimals("piece")).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("accepts local 9-digit numbers with spaces", () => {
    expect(normalizePhone("77 123 45 67")).toBe("+221771234567");
  });
  it("accepts +221, 00221 and 221 prefixes", () => {
    expect(normalizePhone("+221 77 123 45 67")).toBe("+221771234567");
    expect(normalizePhone("00221771234567")).toBe("+221771234567");
    expect(normalizePhone("221781234567")).toBe("+221781234567");
  });
  it("accepts fixed lines starting with 33", () => {
    expect(normalizePhone("33 822 11 22")).toBe("+221338221122");
  });
  it("rejects invalid numbers", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("57 123 45 67")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("formats a normalized number for display", () => {
    expect(formatPhone("+221771234567")).toBe("+221 77 123 45 67");
  });
  it("returns other inputs unchanged", () => {
    expect(formatPhone("abc")).toBe("abc");
  });
});

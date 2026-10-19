import { describe, expect, it } from "vitest";
import { roundQty, stockStatus, weightedAverageCost } from "./stock";

describe("weightedAverageCost", () => {
  it("matches the spec example (10 @ 4000 + 10 @ 5000 = 4500)", () => {
    expect(weightedAverageCost(10, 4000, 10, 5000)).toBe(4500);
  });
  it("rounds to the nearest franc", () => {
    expect(weightedAverageCost(3, 1000, 1, 1001)).toBe(1000);
    expect(weightedAverageCost(1, 1000, 2, 1001)).toBe(1001);
  });
  it("uses the incoming cost when current stock is zero or negative", () => {
    expect(weightedAverageCost(0, 4000, 5, 5000)).toBe(5000);
    expect(weightedAverageCost(-2, 4000, 5, 5000)).toBe(5000);
  });
  it("keeps current cost when nothing comes in", () => {
    expect(weightedAverageCost(5, 4000, 0, 9999)).toBe(4000);
  });
});

describe("stockStatus", () => {
  it("out when nothing is available", () => {
    expect(stockStatus(0, 5)).toBe("out");
    expect(stockStatus(-1, 5)).toBe("out");
  });
  it("low when at or under the alert threshold", () => {
    expect(stockStatus(5, 5)).toBe("low");
    expect(stockStatus(2, 5)).toBe("low");
  });
  it("ok above the threshold", () => {
    expect(stockStatus(6, 5)).toBe("ok");
    expect(stockStatus(1, 0)).toBe("ok");
  });
});

describe("roundQty", () => {
  it("keeps 3 decimals and removes float noise", () => {
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
    expect(roundQty(1.23456)).toBe(1.235);
  });
});

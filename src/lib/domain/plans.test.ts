import { describe, expect, it } from "vitest";
import { canAdd, computePlanState, limitLabel, PLANS } from "./plans";

const now = new Date("2026-10-19T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("PLANS", () => {
  it("matches the validated pricing grid", () => {
    expect(PLANS.trial).toMatchObject({ price: 0, maxProducts: 20, maxEmployees: 0, maxLocations: 1, advancedReports: false });
    expect(PLANS.pro).toMatchObject({ price: 6500, maxProducts: 50, maxEmployees: 3, maxLocations: 1, advancedReports: true });
    expect(PLANS.business).toMatchObject({ price: 11500, maxProducts: null, maxEmployees: null, maxLocations: 3, advancedReports: true });
  });
});

describe("computePlanState", () => {
  it("trial in progress is writable with days left rounded up", () => {
    const s = computePlanState({ plan: "trial", trialEndsAt: days(3.2), periodEndsAt: null, suspendedAt: null }, now);
    expect(s.status).toBe("trialing");
    expect(s.readOnly).toBe(false);
    expect(s.daysLeft).toBe(4);
  });
  it("trial ended is read-only", () => {
    const s = computePlanState({ plan: "trial", trialEndsAt: days(-1), periodEndsAt: null, suspendedAt: null }, now);
    expect(s.status).toBe("expired");
    expect(s.readOnly).toBe(true);
    expect(s.daysLeft).toBe(0);
  });
  it("paid plan within its period is active", () => {
    const s = computePlanState({ plan: "pro", trialEndsAt: days(-20), periodEndsAt: days(10), suspendedAt: null }, now);
    expect(s.status).toBe("active");
    expect(s.readOnly).toBe(false);
    expect(s.limits.maxProducts).toBe(50);
  });
  it("paid plan past its period is expired", () => {
    const s = computePlanState({ plan: "business", trialEndsAt: days(-40), periodEndsAt: days(-1), suspendedAt: null }, now);
    expect(s.status).toBe("expired");
    expect(s.readOnly).toBe(true);
  });
  it("suspension wins over everything", () => {
    const s = computePlanState({ plan: "business", trialEndsAt: days(-40), periodEndsAt: days(20), suspendedAt: days(-1) }, now);
    expect(s.status).toBe("suspended");
    expect(s.readOnly).toBe(true);
  });
});

describe("canAdd", () => {
  it("allows when under the limit", () => {
    expect(canAdd(20, 19)).toBe(true);
  });
  it("blocks at the limit", () => {
    expect(canAdd(20, 20)).toBe(false);
    expect(canAdd(0, 0)).toBe(false);
  });
  it("null means unlimited", () => {
    expect(canAdd(null, 10_000)).toBe(true);
  });
});

describe("limitLabel", () => {
  it("écrit les limites et l'illimité correctement", () => {
    expect(limitLabel(50, "produits")).toBe("50 produits");
    expect(limitLabel(null, "produits")).toBe("Produits illimités");
    expect(limitLabel(null, "employés", { lowercase: true })).toBe("employés illimités");
  });
});

import { describe, expect, it } from "vitest";
import { brandCss } from "./brand";
import { addMonths, canAdd, computePlanState, LICENSE_PACKS, limitLabel, TRIAL } from "./plans";

const now = new Date("2026-10-19T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("TRIAL", () => {
  it("garde les limites de l'essai gratuit", () => {
    expect(TRIAL.limits).toEqual({ maxProducts: 20, maxEmployees: 0, maxLocations: 1, advancedReports: false, excel: false });
  });
});

describe("computePlanState", () => {
  it("trial in progress is writable with days left rounded up", () => {
    const s = computePlanState({ plan: "trial", trialEndsAt: days(3.2), periodEndsAt: null, suspendedAt: null }, now);
    expect(s.status).toBe("trialing");
    expect(s.readOnly).toBe(false);
    expect(s.daysLeft).toBe(4);
    expect(s.label).toBe("Essai gratuit");
  });
  it("trial ended is read-only", () => {
    const s = computePlanState({ plan: "trial", trialEndsAt: days(-1), periodEndsAt: null, suspendedAt: null }, now);
    expect(s.status).toBe("expired");
    expect(s.readOnly).toBe(true);
    expect(s.daysLeft).toBe(0);
  });
  it("sans licence, un ancien abonnement redevient l'essai (plus de formule mensuelle)", () => {
    const s = computePlanState({ plan: "pro", trialEndsAt: days(-20), periodEndsAt: days(10), suspendedAt: null }, now);
    expect(s.plan).toBe("trial");
    expect(s.status).toBe("expired");
    expect(s.license).toBeNull();
  });
  it("suspension wins over everything", () => {
    const s = computePlanState({ plan: "trial", trialEndsAt: days(20), periodEndsAt: null, suspendedAt: days(-1) }, now);
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

describe("licences", () => {
  const base = { plan: "trial", trialEndsAt: null, periodEndsAt: null, suspendedAt: null };

  it("respecte les prix des forfaits validés", () => {
    expect(LICENSE_PACKS.boutique).toMatchObject({ price: 50_000, maintenancePrice: 15_000 });
    expect(LICENSE_PACKS.pro).toMatchObject({ price: 75_000, maintenancePrice: 20_000 });
    expect(LICENSE_PACKS.business).toMatchObject({ price: 90_000, maintenancePrice: 25_000 });
  });

  it("une licence est active avec les limites de son forfait", () => {
    const s = computePlanState({ ...base, licensePack: "pro", maintenanceEndsAt: days(200) }, now);
    expect(s).toMatchObject({ status: "active", readOnly: false, license: "pro", label: "Licence Pro" });
    expect(s.limits).toMatchObject({ maxProducts: null, maxEmployees: 5, maxLocations: 1, excel: true, advancedReports: true });
    expect(s.daysLeft).toBe(200);
  });

  it("ne s'arrête jamais, même maintenance terminée", () => {
    const s = computePlanState({ ...base, licensePack: "boutique", maintenanceEndsAt: days(-90) }, now);
    expect(s).toMatchObject({ status: "active", readOnly: false, daysLeft: 0 });
  });

  it("reste soumise à la suspension", () => {
    const s = computePlanState({ ...base, suspendedAt: now, licensePack: "business", maintenanceEndsAt: days(10) }, now);
    expect(s).toMatchObject({ status: "suspended", readOnly: true });
  });

  it("ignore un forfait inconnu (reste l'essai gratuit)", () => {
    const s = computePlanState({ ...base, licensePack: "inconnu" }, now);
    expect(s.license).toBeNull();
    expect(s.status).toBe("expired");
  });

  it("ajoute des mois à une date", () => {
    expect(addMonths(new Date("2026-10-21T10:00:00Z"), 12).getUTCFullYear()).toBe(2027);
  });
});

describe("couleurs des applications", () => {
  it("n'injecte que des couleurs de la palette", () => {
    expect(brandCss("vert")).toBeNull();
    expect(brandCss("rouge;}body{display:none")).toBeNull();
    expect(brandCss(null)).toBeNull();
    expect(brandCss("bleu")).toContain("--primary:#1d4ed8");
  });
});

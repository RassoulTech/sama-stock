import { describe, expect, it } from "vitest";
import { MAX_CUSTOM_DAYS, param, parseDay, pickParam, presetRange, resolvePeriod } from "./filters";

const NOW = new Date("2026-10-20T15:30:00Z");
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("param / pickParam", () => {
  it("prend la première valeur et ignore les valeurs vides", () => {
    expect(param({ q: ["a", "b"] }, "q")).toBe("a");
    expect(param({ q: "  " }, "q")).toBeUndefined();
  });
  it("refuse une valeur hors liste", () => {
    expect(pickParam({ m: "wave" }, "m", ["cash", "wave"])).toBe("wave");
    expect(pickParam({ m: "bitcoin" }, "m", ["cash", "wave"])).toBeNull();
  });
});

describe("parseDay", () => {
  it("accepte AAAA-MM-JJ et refuse les dates impossibles", () => {
    expect(parseDay("2026-10-05")?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("05/10/2026")).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });
});

describe("presetRange", () => {
  it("aujourd'hui couvre la journée entière", () => {
    const r = presetRange("today", NOW);
    expect(r.from).toEqual(day("2026-10-20"));
    expect(r.to).toEqual(day("2026-10-21"));
    expect(r.days).toBe(1);
  });
  it("hier s'arrête à minuit", () => {
    const r = presetRange("yesterday", NOW);
    expect(r.from).toEqual(day("2026-10-19"));
    expect(r.to).toEqual(day("2026-10-20"));
  });
  it("7 jours inclut aujourd'hui", () => {
    const r = presetRange("7j", NOW);
    expect(r.from).toEqual(day("2026-10-14"));
    expect(r.days).toBe(7);
  });
  it("ce mois-ci et le mois dernier", () => {
    expect(presetRange("mois", NOW).from).toEqual(day("2026-10-01"));
    const last = presetRange("mois-dernier", NOW);
    expect(last.from).toEqual(day("2026-09-01"));
    expect(last.to).toEqual(day("2026-10-01"));
    expect(last.days).toBe(30);
  });
  it("le mois dernier en janvier est décembre de l'année précédente", () => {
    const r = presetRange("mois-dernier", new Date("2027-01-10T10:00:00Z"));
    expect(r.from).toEqual(day("2026-12-01"));
    expect(r.to).toEqual(day("2027-01-01"));
  });
  it("tout n'a pas de bornes", () => {
    const r = presetRange("tout", NOW);
    expect(r.from).toBeNull();
    expect(r.to).toBeNull();
    expect(r.days).toBeNull();
  });
});

describe("resolvePeriod", () => {
  it("retombe sur la période par défaut si la valeur est inconnue ou non permise", () => {
    expect(resolvePeriod({ periode: "n'importe" }, { fallback: "30j", now: NOW }).key).toBe("30j");
    expect(resolvePeriod({ periode: "tout" }, { fallback: "today", allowed: ["today", "7j"], now: NOW }).key).toBe("today");
  });
  it("lit des dates personnalisées (fin incluse)", () => {
    const r = resolvePeriod({ periode: "dates", du: "2026-10-01", au: "2026-10-15" }, { fallback: "30j", now: NOW });
    expect(r.key).toBe("dates");
    expect(r.from).toEqual(day("2026-10-01"));
    expect(r.to).toEqual(day("2026-10-16"));
    expect(r.days).toBe(15);
    expect(r.label).toBe("Du 1 oct. au 15 oct.");
  });
  it("remet les dates dans l'ordre et accepte un seul jour", () => {
    const r = resolvePeriod({ periode: "dates", du: "2026-10-15", au: "2026-10-01" }, { fallback: "30j", now: NOW });
    expect(r.from).toEqual(day("2026-10-01"));
    const one = resolvePeriod({ periode: "dates", du: "2026-10-05" }, { fallback: "30j", now: NOW });
    expect(one.days).toBe(1);
    expect(one.label).toBe("Le 5 oct.");
  });
  it("ne va pas dans le futur et limite la durée", () => {
    const future = resolvePeriod({ periode: "dates", du: "2026-10-18", au: "2027-01-01" }, { fallback: "30j", now: NOW });
    expect(future.to).toEqual(day("2026-10-21"));
    const long = resolvePeriod({ periode: "dates", du: "2020-01-01", au: "2026-10-20" }, { fallback: "30j", now: NOW });
    expect(long.days).toBe(MAX_CUSTOM_DAYS);
  });
  it("des dates invalides retombent sur la période par défaut", () => {
    expect(resolvePeriod({ periode: "dates", du: "hier" }, { fallback: "7j", now: NOW }).key).toBe("7j");
  });
});

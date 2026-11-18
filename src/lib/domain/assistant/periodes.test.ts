import { describe, expect, it } from "vitest";
import { REPORT_PRESETS } from "@/lib/filters";
import { filtrePeriode, intervalle } from "./periodes";

const MAINTENANT = new Date("2026-11-18T15:00:00Z");
const VENTES = ["today", "yesterday", "7j", "30j", "mois", "mois-dernier", "90j"] as const;

describe("filtrePeriode", () => {
  it("keeps a period the page accepts", () => {
    expect(filtrePeriode("mois_dernier", {}, VENTES, MAINTENANT)).toEqual({ periode: "mois-dernier" });
    expect(filtrePeriode("aujourdhui", {}, VENTES, MAINTENANT)).toEqual({ periode: "today" });
  });
  it("turns today and yesterday into a precise day where the page lacks them (reports)", () => {
    expect(filtrePeriode("aujourdhui", {}, REPORT_PRESETS, MAINTENANT)).toEqual({ periode: "dates", du: "2026-11-18", au: "2026-11-18" });
    expect(filtrePeriode("hier", {}, REPORT_PRESETS, MAINTENANT)).toEqual({ periode: "dates", du: "2026-11-17", au: "2026-11-17" });
  });
  it("turns « since the beginning » into the longest period the page allows", () => {
    expect(filtrePeriode("tout", {}, REPORT_PRESETS, MAINTENANT)).toEqual({ periode: "90j" });
  });
  it("reads a day or a range, and refuses a badly written date", () => {
    expect(filtrePeriode("dates", { du: "2026-11-03" }, VENTES, MAINTENANT)).toEqual({ periode: "dates", du: "2026-11-03", au: "2026-11-03" });
    expect(filtrePeriode("dates", { du: "2026-11-01", au: "2026-11-10" }, VENTES, MAINTENANT)).toEqual({ periode: "dates", du: "2026-11-01", au: "2026-11-10" });
    expect(filtrePeriode("dates", { du: "3 novembre" }, VENTES, MAINTENANT)).toBeNull();
    expect(filtrePeriode(undefined, {}, VENTES, MAINTENANT)).toBeNull();
  });
});

describe("intervalle", () => {
  it("gives the dates and label of a period for server reads", () => {
    const mois = intervalle("mois", {}, MAINTENANT);
    expect(mois.from?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(mois.label).toBe("Ce mois-ci");
    const jour = intervalle("dates", { du: "2026-11-03" }, MAINTENANT);
    expect(jour.from?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(jour.to?.toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });
});

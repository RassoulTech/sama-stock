import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { computePlanState } from "@/lib/domain/plans";
import { BuyLicence } from "./buy-licence";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) }));

const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
const render = (trialEndsAt: Date, businessName: string) =>
  renderToStaticMarkup(createElement(BuyLicence, { plan: computePlanState({ plan: "trial", trialEndsAt, suspendedAt: null }), businessName }));

describe("page « Ma licence » pendant l'essai", () => {
  it("présente les trois licences, payées une fois, avec un lien WhatsApp", () => {
    const html = render(days(5), "Quincaillerie Ndiaye");
    expect(html).toContain("Essai gratuit en cours");
    for (const label of ["Licence Boutique", "Licence Pro", "Licence Business"]) expect(html).toContain(label);
    expect(html).toContain("Une seule fois.");
    expect(html).toMatch(/href="https:\/\/wa\.me\/\d+\?text=[^"]*Quincaillerie%20Ndiaye/);
    expect(html).not.toMatch(/abonnement|\/ mois/i);
  });

  it("annonce la fin de l'essai (consultation seule)", () => {
    const html = render(days(-2), "Boutique");
    expect(html).toContain("Votre essai gratuit est terminé");
    expect(html).toContain("essai%20termin");
  });
});

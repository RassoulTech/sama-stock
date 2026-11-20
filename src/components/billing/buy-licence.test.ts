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
    // La licence se paie une fois : seul l'assistant Finch, en option, est un abonnement mensuel.
    expect(html).not.toMatch(/\/ mois/i);
    expect(html.match(/Abonnement à part de la licence/g)).toHaveLength(3);
  });

  it("donne l'offre Finch de chaque licence : installation, mois et crédits", () => {
    // Les montants s'écrivent avec des espaces insécables
    const html = render(days(5), "Quincaillerie Ndiaye").replace(/[  ]/g, " ");
    for (const montant of ["10 000 FCFA", "5 000 FCFA", ">100<", "15 000 FCFA", ">250<", "20 000 FCFA", ">500<"]) {
      expect(html).toContain(montant);
    }
    expect(html.match(/Conversations par mois/g)).toHaveLength(3);
    expect(html).toContain("50 conversations pour 3 000 FCFA");
  });

  it("annonce la fin de l'essai (consultation seule)", () => {
    const html = render(days(-2), "Boutique");
    expect(html).toContain("Votre essai gratuit est terminé");
    expect(html).toContain("essai%20termin");
  });
});

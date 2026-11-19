import { describe, expect, it } from "vitest";
import { ASSISTANT_OFFERS, ASSISTANT_RECHARGE, ASSISTANT_TRIAL_CREDITS } from "../plans";
import { formatFCFA } from "@/lib/format";
import {
  boutonAssistantVisible,
  etatAssistant,
  ficheAssistant,
  finAbonnement,
  libellePaiement,
  messageAssistant,
  montantParDefaut,
  moisPlus,
  peutAnnuler,
  planifierMois,
  rappelPour,
  rentabilite,
  texteCredits,
  type MoisAssistant,
} from "./abonnement";

const d = (s: string) => new Date(s);
const now = d("2026-11-19T10:00:00Z");
const mois = (p: Partial<MoisAssistant> & Pick<MoisAssistant, "startsAt" | "endsAt">): MoisAssistant => ({
  id: "m1",
  kind: "abonnement",
  credits: 250,
  extraCredits: 0,
  used: 0,
  ...p,
});
const sousLicence = { status: "active" as const, license: "pro" as const };
const enEssai = { status: "trialing" as const, license: null };
const enCours = mois({ startsAt: d("2026-11-05T08:00:00Z"), endsAt: d("2026-12-05T08:00:00Z"), used: 63 });

describe("catalogue de l'assistant", () => {
  it("donne une offre par licence", () => {
    expect(ASSISTANT_OFFERS.boutique).toEqual({ activationPrice: 10_000, monthlyPrice: 5_000, monthlyCredits: 100 });
    expect(ASSISTANT_OFFERS.pro).toEqual({ activationPrice: 15_000, monthlyPrice: 10_000, monthlyCredits: 250 });
    expect(ASSISTANT_OFFERS.business).toEqual({ activationPrice: 20_000, monthlyPrice: 15_000, monthlyCredits: 500 });
    expect(ASSISTANT_RECHARGE).toEqual({ credits: 50, price: 3_000 });
    expect(ASSISTANT_TRIAL_CREDITS).toBe(10);
  });
});

describe("moisPlus", () => {
  it("garde le jour du mois", () => {
    expect(moisPlus(d("2026-11-19T10:00:00Z"), 1)).toEqual(d("2026-12-19T10:00:00Z"));
  });
  it("ramène au dernier jour d'un mois plus court", () => {
    expect(moisPlus(d("2027-01-31T10:00:00Z"), 1)).toEqual(d("2027-02-28T10:00:00Z"));
    expect(moisPlus(d("2027-01-31T10:00:00Z"), 2)).toEqual(d("2027-03-31T10:00:00Z"));
  });
});

describe("planifierMois", () => {
  it("part d'aujourd'hui quand rien n'est en cours", () => {
    expect(planifierMois([], 2, now)).toEqual([
      { startsAt: now, endsAt: d("2026-12-19T10:00:00Z") },
      { startsAt: d("2026-12-19T10:00:00Z"), endsAt: d("2027-01-19T10:00:00Z") },
    ]);
  });
  it("ajoute les mois payés d'avance après la fin actuelle", () => {
    expect(planifierMois([enCours], 1, now)).toEqual([{ startsAt: d("2026-12-05T08:00:00Z"), endsAt: d("2027-01-05T08:00:00Z") }]);
  });
  it("repart d'aujourd'hui après une expiration et ignore l'essai", () => {
    const fini = mois({ startsAt: d("2026-09-01T08:00:00Z"), endsAt: d("2026-10-01T08:00:00Z") });
    const essai = mois({ kind: "essai", credits: 10, startsAt: d("2026-11-10T08:00:00Z"), endsAt: d("2026-11-24T08:00:00Z") });
    expect(planifierMois([fini, essai], 1, now)[0].startsAt).toEqual(now);
  });
  it("ne dérive pas en fin de mois", () => {
    expect(planifierMois([], 3, d("2027-01-31T10:00:00Z")).map((m) => m.endsAt)).toEqual([
      d("2027-02-28T10:00:00Z"),
      d("2027-03-31T10:00:00Z"),
      d("2027-04-30T10:00:00Z"),
    ]);
  });
});

describe("finAbonnement", () => {
  it("rend la fin du dernier mois d'abonnement, sans l'essai", () => {
    const avance = mois({ id: "m2", startsAt: d("2026-12-05T08:00:00Z"), endsAt: d("2027-01-05T08:00:00Z") });
    const essai = mois({ kind: "essai", credits: 10, startsAt: d("2026-11-10T08:00:00Z"), endsAt: d("2027-06-01T08:00:00Z") });
    expect(finAbonnement([enCours, avance, essai])).toEqual(d("2027-01-05T08:00:00Z"));
    expect(finAbonnement([essai])).toBeNull();
  });
});

describe("boutonAssistantVisible", () => {
  it("montre le micro aux démos, aux licences et pendant l'essai", () => {
    expect(boutonAssistantVisible(sousLicence, false)).toBe(true);
    expect(boutonAssistantVisible(enEssai, false)).toBe(true);
    expect(boutonAssistantVisible({ status: "active", license: "boutique" }, true)).toBe(true);
  });
  it("le cache pour un commerce suspendu ou un essai fini", () => {
    expect(boutonAssistantVisible({ status: "suspended", license: "pro" }, false)).toBe(false);
    expect(boutonAssistantVisible({ status: "expired", license: null }, false)).toBe(false);
  });
});

describe("etatAssistant", () => {
  it("démonstration", () => {
    expect(etatAssistant({ isDemo: true, plan: { status: "active", license: "business" }, mois: [] }, now).statut).toBe("demo");
  });
  it("sous licence, jamais activé : inactif", () => {
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [] }, now)).toEqual({
      statut: "inactif",
      offre: "pro",
      mois: null,
      restants: 0,
      total: 0,
      finLe: null,
    });
  });
  it("mois en cours avec crédits et recharge : actif", () => {
    const recharge = { ...enCours, extraCredits: 50 };
    const e = etatAssistant({ isDemo: false, plan: sousLicence, mois: [recharge] }, now);
    expect(e).toMatchObject({ statut: "actif", restants: 237, total: 300, finLe: d("2026-12-05T08:00:00Z") });
    expect(e.mois?.id).toBe("m1");
  });
  it("mois payé d'avance : la fin est celle du dernier", () => {
    const avance = mois({ id: "m2", startsAt: d("2026-12-05T08:00:00Z"), endsAt: d("2027-01-05T08:00:00Z") });
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [enCours, avance] }, now).finLe).toEqual(d("2027-01-05T08:00:00Z"));
  });
  it("tous les crédits utilisés : épuisé", () => {
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [{ ...enCours, used: 250 }] }, now)).toMatchObject({ statut: "epuise", restants: 0 });
  });
  it("plus aucun mois en cours : expiré", () => {
    const fini = mois({ startsAt: d("2026-09-01T08:00:00Z"), endsAt: d("2026-10-01T08:00:00Z") });
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [fini] }, now)).toMatchObject({ statut: "expire", finLe: d("2026-10-01T08:00:00Z") });
  });
  it("essai sans fenêtre : 10 conversations offertes", () => {
    expect(etatAssistant({ isDemo: false, plan: enEssai, mois: [] }, now)).toMatchObject({ statut: "essai", restants: 10, total: 10, offre: null });
  });
  it("essai avec fenêtre entamée, puis épuisé", () => {
    const essai = mois({ kind: "essai", credits: 10, used: 4, startsAt: d("2026-11-10T08:00:00Z"), endsAt: d("2026-11-24T08:00:00Z") });
    expect(etatAssistant({ isDemo: false, plan: enEssai, mois: [essai] }, now)).toMatchObject({ statut: "essai", restants: 6 });
    expect(etatAssistant({ isDemo: false, plan: enEssai, mois: [{ ...essai, used: 10 }] }, now)).toMatchObject({ statut: "essai_epuise", restants: 0 });
  });
  it("sous licence, la fenêtre d'essai ne compte plus", () => {
    const essai = mois({ kind: "essai", credits: 10, used: 2, startsAt: d("2026-11-10T08:00:00Z"), endsAt: d("2026-11-24T08:00:00Z") });
    expect(etatAssistant({ isDemo: false, plan: sousLicence, mois: [essai] }, now).statut).toBe("inactif");
  });
  it("commerce suspendu ou essai fini : indisponible", () => {
    expect(etatAssistant({ isDemo: false, plan: { status: "suspended", license: "pro" }, mois: [enCours] }, now).statut).toBe("indisponible");
    expect(etatAssistant({ isDemo: false, plan: { status: "expired", license: null }, mois: [] }, now).statut).toBe("indisponible");
  });
});

describe("ficheAssistant", () => {
  const o = { boutique: "Awa Mode", peutPayer: true, support: "221773831364" };
  it("rien à montrer quand Finch peut parler", () => {
    expect(ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [enCours] }, now), o)).toBeNull();
    expect(ficheAssistant(etatAssistant({ isDemo: false, plan: enEssai, mois: [] }, now), o)).toBeNull();
  });
  it("inactif : l'offre de la licence et un lien WhatsApp pré-rempli", () => {
    const f = ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [] }, now), o);
    expect(f?.titre).toBe("Finch, ton employé qui parle wolof");
    expect(f?.texte).toContain("250 conversations par mois");
    expect(f?.texte).toContain(formatFCFA(15_000));
    expect(f?.bouton).toBe("Activer Finch");
    expect(f?.lien).toBe(`https://wa.me/221773831364?text=${encodeURIComponent("Bonjour, je veux activer Finch pour Awa Mode (licence Pro).")}`);
  });
  it("épuisé : la recharge et la fin du mois", () => {
    const f = ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [{ ...enCours, used: 250 }] }, now), o);
    expect(f?.texte).toContain("250 conversations");
    expect(f?.texte).toContain("50 conversations");
    expect(f?.bouton).toBe("Demander une recharge");
  });
  it("employé : pas de prix ni de lien", () => {
    const f = ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [] }, now), { ...o, peutPayer: false });
    expect(f).toMatchObject({ bouton: null, lien: null });
    expect(f?.texte).toContain("préviens le propriétaire");
  });
  it("sans numéro d'assistance : pas de bouton", () => {
    expect(ficheAssistant(etatAssistant({ isDemo: false, plan: sousLicence, mois: [] }, now), { ...o, support: null })).toMatchObject({ bouton: null, lien: null });
  });
});

describe("texteCredits", () => {
  it("compte et alerte à partir de 10", () => {
    expect(texteCredits(187, false)).toEqual({ texte: "187 conversations restantes", alerte: false });
    expect(texteCredits(10, false).alerte).toBe(true);
    expect(texteCredits(1, true)).toEqual({ texte: "1 conversation d'essai restante", alerte: true });
  });
});

describe("montants et libellés", () => {
  it("pré-remplit les montants du catalogue", () => {
    expect(montantParDefaut("pro", "activation", 1)).toBe(25_000);
    expect(montantParDefaut("pro", "mois", 3)).toBe(30_000);
    expect(montantParDefaut("boutique", "recharge")).toBe(3_000);
  });
  it("décrit chaque paiement", () => {
    expect(libellePaiement({ kind: "activation", months: 1, credits: 0 })).toBe("Activation + 1 mois");
    expect(libellePaiement({ kind: "mois", months: 3, credits: 0 })).toBe("3 mois");
    expect(libellePaiement({ kind: "recharge", months: 0, credits: 50 })).toBe("Recharge de 50 conversations");
  });
});

describe("peutAnnuler", () => {
  it("des mois encore intacts", () => {
    expect(peutAnnuler({ kind: "mois", credits: 0 }, [{ ...enCours, used: 0 }], null)).toBe(true);
    expect(peutAnnuler({ kind: "activation", credits: 0 }, [enCours], null)).toBe(false);
  });
  it("une recharge dont les crédits restent disponibles", () => {
    expect(peutAnnuler({ kind: "recharge", credits: 50 }, [], { ...enCours, extraCredits: 50, used: 250 })).toBe(true);
    expect(peutAnnuler({ kind: "recharge", credits: 50 }, [], { ...enCours, extraCredits: 50, used: 251 })).toBe(false);
    expect(peutAnnuler({ kind: "recharge", credits: 50 }, [], null)).toBe(false);
  });
});

describe("rentabilite", () => {
  it("compare l'argent encaissé au coût Google estimé", () => {
    expect(rentabilite(60_000, 400)).toEqual({ encaisse: 60_000, conversations: 400, cout: 20_000, marge: 40_000 });
    expect(rentabilite(0, 10, 100).marge).toBe(-1_000);
  });
});

describe("rappels", () => {
  const fin = d("2026-11-22T10:00:00Z");
  it("prévient 3 jours avant, puis le jour de la fin", () => {
    expect(rappelPour(fin, d("2026-11-19T11:00:00Z"))).toBe("bientot");
    expect(rappelPour(fin, d("2026-11-20T11:00:00Z"))).toBeNull();
    expect(rappelPour(fin, d("2026-11-22T11:00:00Z"))).toBe("termine");
    expect(rappelPour(fin, d("2026-11-23T11:00:00Z"))).toBeNull();
  });
  it("écrit des messages qui mènent à la page Licence", () => {
    expect(messageAssistant("dix")).toMatchObject({ kind: "assistant", href: "/licence" });
    expect(messageAssistant("bientot", fin).body).toContain("22");
  });
});

import { describe, expect, it } from "vitest";
import { choisirBouton, estRisque, libellesUniques, normaliser } from "./boutons";

const b = (...libelles: string[]) => libelles.map((libelle, i) => ({ libelle, element: i }));

describe("normaliser", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normaliser("  Reçu — PDF ! ")).toBe("recu pdf");
  });
});

describe("choisirBouton", () => {
  const boutons = b("Tableau de bord", "Produits", "Nouveau produit", "Envoyer le reçu (PDF)", "Reçu PDF");
  it("prefers the exact label", () => {
    expect(choisirBouton("produits", boutons)?.element).toBe(1);
    expect(choisirBouton("reçu pdf", boutons)?.element).toBe(4);
  });
  it("accepts the beginning of a label, or its words in any order", () => {
    expect(choisirBouton("nouveau", boutons)?.element).toBe(2);
    expect(choisirBouton("envoyer le reçu", boutons)?.element).toBe(3);
    expect(choisirBouton("bord tableau", boutons)?.element).toBe(0);
  });
  it("returns null when nothing matches", () => {
    expect(choisirBouton("factures", boutons)).toBeNull();
    expect(choisirBouton("", boutons)).toBeNull();
  });
});

describe("estRisque", () => {
  it("lets links and harmless buttons through", () => {
    expect(estRisque("Supprimer les filtres", { lien: true, soumission: false })).toBe(false);
    expect(estRisque("Stock bas", { lien: false, soumission: false })).toBe(false);
    expect(estRisque("Encaisser", { lien: false, soumission: false })).toBe(false);
  });
  it("asks before writing, sending or deleting", () => {
    expect(estRisque("Valider la vente", { lien: false, soumission: false })).toBe(true);
    expect(estRisque("Supprimer", { lien: false, soumission: false })).toBe(true);
    expect(estRisque("Envoyer le reçu (PDF)", { lien: false, soumission: false })).toBe(true);
    expect(estRisque("OK", { lien: false, soumission: true })).toBe(true);
    expect(estRisque("Se déconnecter", { lien: true, soumission: false })).toBe(true);
  });
});

describe("libellesUniques", () => {
  it("drops duplicates and caps the list", () => {
    expect(libellesUniques(b("Produits", "produits", "Ventes", "Clients"), 2)).toEqual(["Produits", "Ventes"]);
  });
});

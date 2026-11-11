import { describe, expect, it, vi } from "vitest";
import type { Mission } from "@/lib/domain/assistant/mission";
import { jouer, type ReponseAccord, type Scene } from "./moteur";
import type { Etape, NomPilote } from "./types";

function fausseScene(o: { pilotes?: Partial<Record<NomPilote, unknown>>; reponse?: ReponseAccord; navigation?: boolean; cibles?: boolean; avantDemande?: () => void } = {}) {
  const journal: string[] = [];
  const scene: Scene = {
    ouvrir: async (url) => {
      journal.push(`ouvrir ${url}`);
      return o.navigation ?? true;
    },
    pilote: async (nom) => (o.pilotes?.[nom] ?? null) as never,
    pointer: async (cible) => {
      journal.push(`doigt ${cible}`);
      return o.cibles ?? true;
    },
    pause: async () => {},
    statut: () => {},
    dire: (cle) => journal.push(`dire ${cle}`),
    demander: async (resume) => {
      journal.push(`demander ${resume}`);
      o.avantDemande?.();
      return o.reponse ?? { type: "oui" };
    },
  };
  return { scene, journal };
}

const ETAPES: Etape[] = [
  { type: "ouvrir", url: "/stock/entree", texte: "J'ouvre" },
  { type: "attendre", pilote: "entree" },
  { type: "agir", pilote: "entree", op: "ajouterLigne", args: ["p1", 10, null], cible: "entree.ajouter", texte: "J'ajoute" },
  { type: "confirmer", cible: "entree.valider", resume: "Entrée de 1 produit" },
  { type: "enregistrer", pilote: "entree", op: "enregistrer", args: [], cible: "entree.valider" },
];
const entree = (resultat = { ok: true, message: "Entrée de stock enregistrée" }) => ({ ajouterLigne: vi.fn(), enregistrer: vi.fn(async () => resultat) });
const signal = () => new AbortController().signal;

describe("jouer", () => {
  it("plays the gestures, asks, then presses the final button after yes", async () => {
    const pilote = entree();
    const { scene, journal } = fausseScene({ pilotes: { entree: pilote } });
    await expect(jouer(ETAPES, scene, signal())).resolves.toEqual({ etat: "enregistre", message: "Entrée de stock enregistrée" });
    expect(pilote.ajouterLigne).toHaveBeenCalledWith("p1", 10, null);
    expect(journal).toEqual([
      "ouvrir /stock/entree",
      "doigt entree.ajouter",
      "doigt entree.valider",
      "dire je-peux-enregistrer",
      "demander Entrée de 1 produit",
      "doigt entree.valider",
      "dire enregistre",
    ]);
  });
  it("leaves the screen filled on no", async () => {
    const pilote = entree();
    const { scene, journal } = fausseScene({ pilotes: { entree: pilote }, reponse: { type: "non" } });
    await expect(jouer(ETAPES, scene, signal())).resolves.toEqual({ etat: "laisse" });
    expect(pilote.enregistrer).not.toHaveBeenCalled();
    expect(journal.at(-1)).toBe("dire laisse");
  });
  it("hands a spoken correction back to the caller", async () => {
    const mission = { type: "ecran", ecran: { ecran: "commandes", url: "/commandes", cible: "commandes.liste", titre: "Commandes" } } as Mission;
    const { scene } = fausseScene({ pilotes: { entree: entree() }, reponse: { type: "correction", mission } });
    await expect(jouer(ETAPES, scene, signal())).resolves.toEqual({ etat: "corrige", mission });
  });
  it("stops when the screen never answers or the page does not open", async () => {
    await expect(jouer(ETAPES, fausseScene().scene, signal())).resolves.toEqual({ etat: "arrete", raison: "ecran" });
    await expect(jouer(ETAPES, fausseScene({ pilotes: { entree: entree() }, navigation: false }).scene, signal())).resolves.toEqual({ etat: "arrete", raison: "ecran" });
  });
  it("keeps going without the finger when a target is missing", async () => {
    const pilote = entree();
    await expect(jouer(ETAPES, fausseScene({ pilotes: { entree: pilote }, cibles: false }).scene, signal())).resolves.toMatchObject({ etat: "enregistre" });
    expect(pilote.ajouterLigne).toHaveBeenCalled();
  });
  it("reports the refusal of the action and says there is a problem", async () => {
    const { scene, journal } = fausseScene({ pilotes: { entree: entree({ ok: false, message: "Stock insuffisant" }) } });
    await expect(jouer(ETAPES, scene, signal())).resolves.toEqual({ etat: "refuse", message: "Stock insuffisant" });
    expect(journal.at(-1)).toBe("dire souci");
  });
  it("turns a crash of the screen into a refusal", async () => {
    const pilote = {
      ajouterLigne: vi.fn(),
      enregistrer: vi.fn(async () => {
        throw new Error("boum");
      }),
    };
    await expect(jouer(ETAPES, fausseScene({ pilotes: { entree: pilote } }).scene, signal())).resolves.toEqual({
      etat: "refuse",
      message: "Une erreur est survenue à l'enregistrement.",
    });
  });
  it("stops at once when the user takes back control", async () => {
    const controle = new AbortController();
    const pilote = entree();
    const { scene } = fausseScene({ pilotes: { entree: pilote }, avantDemande: () => controle.abort() });
    await expect(jouer(ETAPES, scene, controle.signal)).resolves.toEqual({ etat: "arrete", raison: "reprise" });
    expect(pilote.enregistrer).not.toHaveBeenCalled();
  });
  it("ends a screen mission with « montre »", async () => {
    const { scene, journal } = fausseScene();
    const etapes: Etape[] = [
      { type: "ouvrir", url: "/commandes", texte: "J'ouvre" },
      { type: "montrer", cible: "commandes.liste", texte: "Commandes" },
    ];
    await expect(jouer(etapes, scene, signal())).resolves.toEqual({ etat: "montre" });
    expect(journal).toEqual(["ouvrir /commandes", "doigt commandes.liste"]);
  });
});

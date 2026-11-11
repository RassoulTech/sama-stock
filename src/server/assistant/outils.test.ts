import { describe, expect, it, vi } from "vitest";
import type { Draft } from "@/lib/domain/assistant/drafts";
import { executerOutil, type OutilDeps } from "./outils";

const CLIENT: Draft = { action: "customer", name: "Fatou Sall", phone: "", address: "" };
const ECRAN = { ecran: "tableau_de_bord" as const, url: "/tableau-de-bord", cible: "tdb.chiffre", titre: "Tableau de bord" };

const deps = (): OutilDeps & { read: ReturnType<typeof vi.fn>; draft: ReturnType<typeof vi.fn>; ecran: ReturnType<typeof vi.fn> } => ({
  read: vi.fn(async () => ({ chiffre_affaires: 26400 })),
  draft: vi.fn(() => ({ ok: true as const, draft: CLIENT })),
  ecran: vi.fn(() => ({ ok: true as const, ecran: ECRAN })),
});
const tous = new Set(["resume_ventes", "brouillon_client", "montrer_ecran"]);

describe("executerOutil", () => {
  it("refuses a tool that this user may not use, without calling anything", async () => {
    const d = deps();
    await expect(executerOutil("brouillon_vente", {}, tous, d)).resolves.toEqual({ reponse: { erreur: "Outil non autorisé pour cet utilisateur." }, mission: null });
    expect(d.draft).not.toHaveBeenCalled();
  });
  it("answers a read tool with the reader's data", async () => {
    const d = deps();
    await expect(executerOutil("resume_ventes", { periode: "aujourdhui" }, tous, d)).resolves.toEqual({ reponse: { chiffre_affaires: 26400 }, mission: null });
    expect(d.read).toHaveBeenCalledWith("resume_ventes", { periode: "aujourdhui" });
  });
  it("turns a valid draft into a task mission and describes it without ids", async () => {
    await expect(executerOutil("brouillon_client", { nom: "Fatou Sall" }, tous, deps())).resolves.toEqual({
      reponse: { ok: true, brouillon: { action: "nouveau_client", nom: "Fatou Sall", telephone: null, adresse: null } },
      mission: { type: "tache", tache: CLIENT },
    });
  });
  it("passes a refused draft back with its candidates", async () => {
    const d = deps();
    d.draft.mockReturnValueOnce({ ok: false, reason: "Plusieurs clients correspondent à « awa ».", candidates: ["Awa Ndiaye", "Awa Diop"] });
    await expect(executerOutil("brouillon_client", { nom: "awa" }, tous, d)).resolves.toEqual({
      reponse: { ok: false, raison: "Plusieurs clients correspondent à « awa ».", candidats: ["Awa Ndiaye", "Awa Diop"] },
      mission: null,
    });
  });
  it("opens a screen", async () => {
    await expect(executerOutil("montrer_ecran", { ecran: "tableau_de_bord" }, tous, deps())).resolves.toEqual({
      reponse: { ok: true, ecran: "Tableau de bord" },
      mission: { type: "ecran", ecran: ECRAN },
    });
  });
  it("rejects an unknown tool", async () => {
    await expect(executerOutil("pirater", {}, new Set(["pirater"]), deps())).resolves.toEqual({ reponse: { erreur: "Outil inconnu." }, mission: null });
  });
});

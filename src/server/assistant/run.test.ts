// src/server/assistant/run.test.ts
import { describe, expect, it, vi } from "vitest";
import type { Draft } from "@/lib/domain/assistant/drafts";
import { toolDeclarations } from "@/lib/domain/assistant/tools";
import type { GeminiCall, GeminiContent, GeminiRequest } from "./gemini";
import { AssistantError, runAssistant, USER_INSTRUCTION, type RunInput } from "./run";

const PAYMENT: Draft = {
  action: "payment",
  amount: 5000,
  method: "wave",
  customer: { id: "c1", name: "Awa Ndiaye" },
  payload: { customerId: "c1", amount: 5000, method: "wave" },
};

const call = (name: string, args: Record<string, unknown> = {}, extra: Partial<GeminiContent["parts"][number]> = {}): GeminiContent => ({
  role: "model",
  parts: [{ functionCall: { name, args }, ...extra }],
});
const final = (texte = "Il te reste 40 kilos.", langue = "fr") => call("repondre", { transcription: "il me reste combien de riz", langue, texte });

function scripted(...responses: GeminiContent[]) {
  const requests: GeminiRequest[] = [];
  const gemini: GeminiCall = async (req) => {
    requests.push(structuredClone(req));
    const next = responses.shift();
    if (!next) throw new Error("plus de réponse prévue");
    return next;
  };
  return { gemini, requests };
}

const input: RunInput = {
  system: "SYS",
  history: [],
  audio: { mimeType: "audio/wav", data: "QUJD" },
  tools: toolDeclarations(["stock_produit", "brouillon_paiement_client", "montrer_ecran", "confirmer", "repondre"], { costs: false }),
};
const SCREEN = { ecran: "tableau_de_bord" as const, url: "/tableau-de-bord", cible: "tdb.chiffre", titre: "Tableau de bord" };
const deps = (gemini: GeminiCall) => ({
  gemini,
  read: vi.fn(async () => ({ disponible: 40 })),
  draft: vi.fn(() => ({ ok: true as const, draft: PAYMENT })),
  ecran: vi.fn(() => ({ ok: true as const, ecran: SCREEN })),
});

describe("runAssistant", () => {
  it("returns the final answer, sending the audio and the instruction", async () => {
    const { gemini, requests } = scripted(final("Bonjour !"));
    const reply = await runAssistant(input, deps(gemini));
    expect(reply).toEqual({ transcription: "il me reste combien de riz", langue: "fr", texte: "Bonjour !", mission: null, confirmation: null });
    expect(requests[0].contents[0].parts).toEqual([{ inlineData: input.audio }, { text: USER_INSTRUCTION }]);
  });
  it("puts the previous exchanges before the audio", async () => {
    const { gemini, requests } = scripted(final());
    await runAssistant({ ...input, history: [{ role: "user", text: "salut" }, { role: "assistant", text: "Bonjour" }] }, deps(gemini));
    expect(requests[0].contents[0].parts[0]).toEqual({ text: "Échanges précédents :\nCommerçant : salut\nAssistant : Bonjour" });
  });
  it("runs a read tool and sends the model content back with its signature", async () => {
    const { gemini, requests } = scripted(call("stock_produit", { produit: "riz" }, { thoughtSignature: "SIG" }), final());
    const d = deps(gemini);
    await runAssistant(input, d);
    expect(d.read).toHaveBeenCalledWith("stock_produit", { produit: "riz" });
    expect(requests[1].contents[1]).toEqual(call("stock_produit", { produit: "riz" }, { thoughtSignature: "SIG" }));
    expect(requests[1].contents[2]).toEqual({ role: "user", parts: [{ functionResponse: { name: "stock_produit", response: { disponible: 40 } } }] });
  });
  it("returns the draft prepared during the turn", async () => {
    const { gemini, requests } = scripted(call("brouillon_paiement_client", { client: "awa", montant: 5000, paiement: "wave" }), final("Valide pour enregistrer."));
    const reply = await runAssistant(input, deps(gemini));
    expect(reply.mission).toEqual({ type: "tache", tache: PAYMENT });
    expect(requests[1].contents[2].parts[0].functionResponse?.response).toMatchObject({ ok: true, brouillon: { action: "paiement_client", client: "Awa Ndiaye" } });
  });
  it("passes a refused draft back to the model, without draft", async () => {
    const { gemini, requests } = scripted(call("brouillon_paiement_client", { client: "awa" }), final("Quel montant ?"));
    const d = { ...deps(gemini), draft: vi.fn(() => ({ ok: false as const, reason: "Montant manquant.", candidates: ["Awa Ndiaye", "Awa Diop"] })) };
    const reply = await runAssistant(input, d);
    expect(reply.mission).toBeNull();
    expect(requests[1].contents[2].parts[0].functionResponse?.response).toEqual({ ok: false, raison: "Montant manquant.", candidats: ["Awa Ndiaye", "Awa Diop"] });
  });
  it("refuses a tool that was not offered to this role", async () => {
    const { gemini, requests } = scripted(call("brouillon_entree_stock", { lignes: [] }), final());
    const d = deps(gemini);
    await runAssistant(input, d);
    expect(d.draft).not.toHaveBeenCalled();
    expect(requests[1].contents[2].parts[0].functionResponse?.response).toEqual({ erreur: "Outil non autorisé pour cet utilisateur." });
  });
  it("answers in a single call when a valid draft comes with repondre", async () => {
    const both: GeminiContent = { role: "model", parts: [...call("brouillon_paiement_client", {}).parts, ...final("C'est prêt, valide.").parts] };
    const { gemini, requests } = scripted(both);
    const reply = await runAssistant(input, deps(gemini));
    expect(reply.texte).toBe("C'est prêt, valide.");
    expect(reply.mission).toEqual({ type: "tache", tache: PAYMENT });
    expect(requests).toHaveLength(1);
  });
  it("asks again when the draft that came with repondre is refused", async () => {
    const both: GeminiContent = { role: "model", parts: [...call("brouillon_paiement_client", {}).parts, ...final().parts] };
    const { gemini, requests } = scripted(both, final("Quel client ?"));
    const d = { ...deps(gemini), draft: vi.fn(() => ({ ok: false as const, reason: "Client introuvable." })) };
    const reply = await runAssistant(input, d);
    expect(reply.texte).toBe("Quel client ?");
    expect(reply.mission).toBeNull();
    expect(requests[1].contents[2].parts.map((p) => p.functionResponse?.name)).toEqual(["brouillon_paiement_client", "repondre"]);
    expect(requests[1].contents[2].parts[1].functionResponse?.response).toMatchObject({ ok: false });
  });
  it("asks again when a read tool comes with repondre (its answer has not seen the result)", async () => {
    const both: GeminiContent = { role: "model", parts: [...call("stock_produit", { produit: "riz" }).parts, ...final().parts] };
    const { gemini, requests } = scripted(both, final("Il te reste 40 kilos."));
    const reply = await runAssistant(input, deps(gemini));
    expect(reply.texte).toBe("Il te reste 40 kilos.");
    expect(requests).toHaveLength(2);
  });
  it("gives up when the model never answers with a tool", async () => {
    const { gemini } = scripted({ role: "model", parts: [{ text: "hmm" }] });
    await expect(runAssistant(input, deps(gemini))).rejects.toBeInstanceOf(AssistantError);
  });
  it("gives up after 4 calls", async () => {
    const { gemini } = scripted(...Array.from({ length: 4 }, () => call("stock_produit", { produit: "riz" })));
    await expect(runAssistant(input, deps(gemini))).rejects.toBeInstanceOf(AssistantError);
  });
  it("rejects an invalid final answer", async () => {
    const { gemini } = scripted(call("repondre", { transcription: "x", langue: "en", texte: "Hello" }));
    await expect(runAssistant(input, deps(gemini))).rejects.toBeInstanceOf(AssistantError);
  });
  it("truncates a long transcription and answer to 800 characters", async () => {
    const long = "a".repeat(1000);
    const { gemini } = scripted(call("repondre", { transcription: long, langue: "fr", texte: long }));
    const reply = await runAssistant(input, deps(gemini));
    expect(reply.transcription).toHaveLength(800);
    expect(reply.texte).toHaveLength(800);
  });
  it("echoes the id of a function call in its response", async () => {
    const withId: GeminiContent = { role: "model", parts: [{ functionCall: { id: "c1", name: "stock_produit", args: { produit: "riz" } } }] };
    const { gemini, requests } = scripted(withId, final());
    await runAssistant(input, deps(gemini));
    expect(requests[1].contents[2].parts[0].functionResponse).toMatchObject({ id: "c1", name: "stock_produit" });
  });
});

describe("runAssistant — écrans et accord", () => {
  it("shows a screen in a single call when montrer_ecran comes with repondre", async () => {
    const both: GeminiContent = { role: "model", parts: [...call("montrer_ecran", { ecran: "tableau_de_bord" }).parts, ...final("Voilà ton tableau de bord.").parts] };
    const { gemini, requests } = scripted(both);
    const reply = await runAssistant(input, deps(gemini));
    expect(requests).toHaveLength(1);
    expect(reply.mission).toEqual({ type: "ecran", ecran: SCREEN });
  });
  it("returns the user's agreement", async () => {
    const both: GeminiContent = { role: "model", parts: [...call("confirmer", { reponse: "oui" }).parts, ...final("Je l'enregistre.").parts] };
    const { gemini } = scripted(both);
    const reply = await runAssistant({ ...input, attente: '{"action":"paiement_client"}' }, deps(gemini));
    expect(reply).toMatchObject({ confirmation: "oui", mission: null });
  });
  it("puts the waiting task before the audio", async () => {
    const { gemini, requests } = scripted(final("D'accord."));
    await runAssistant({ ...input, attente: '{"action":"paiement_client"}' }, deps(gemini));
    const parts = requests[0].contents[0].parts;
    expect(parts[0].text).toContain('Tâche remplie à l\'écran, en attente de l\'accord du commerçant : {"action":"paiement_client"}');
    expect(parts[1].inlineData).toBeDefined();
  });
  it("asks again when the screen is refused", async () => {
    const d = deps(scripted().gemini);
    const { gemini, requests } = scripted(call("montrer_ecran", { ecran: "client" }), final("Quel client ?"));
    d.gemini = gemini;
    d.ecran.mockReturnValueOnce({ ok: false, reason: "Dis le nom du client." } as never);
    const reply = await runAssistant(input, d);
    expect(requests).toHaveLength(2);
    expect(reply.mission).toBeNull();
  });
});

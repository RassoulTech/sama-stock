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
  tools: toolDeclarations(["stock_produit", "brouillon_paiement_client", "repondre"], { costs: false }),
};
const deps = (gemini: GeminiCall) => ({
  gemini,
  read: vi.fn(async () => ({ disponible: 40 })),
  draft: vi.fn(() => ({ ok: true as const, draft: PAYMENT })),
});

describe("runAssistant", () => {
  it("returns the final answer, sending the audio and the instruction", async () => {
    const { gemini, requests } = scripted(final("Bonjour !"));
    const reply = await runAssistant(input, deps(gemini));
    expect(reply).toEqual({ transcription: "il me reste combien de riz", langue: "fr", texte: "Bonjour !", brouillon: null });
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
    expect(reply.brouillon).toEqual(PAYMENT);
    expect(requests[1].contents[2].parts[0].functionResponse?.response).toMatchObject({ ok: true, brouillon: { action: "paiement_client", client: "Awa Ndiaye" } });
  });
  it("passes a refused draft back to the model, without draft", async () => {
    const { gemini, requests } = scripted(call("brouillon_paiement_client", { client: "awa" }), final("Quel montant ?"));
    const d = { ...deps(gemini), draft: vi.fn(() => ({ ok: false as const, reason: "Montant manquant.", candidates: ["Awa Ndiaye", "Awa Diop"] })) };
    const reply = await runAssistant(input, d);
    expect(reply.brouillon).toBeNull();
    expect(requests[1].contents[2].parts[0].functionResponse?.response).toEqual({ ok: false, raison: "Montant manquant.", candidats: ["Awa Ndiaye", "Awa Diop"] });
  });
  it("refuses a tool that was not offered to this role", async () => {
    const { gemini, requests } = scripted(call("brouillon_entree_stock", { lignes: [] }), final());
    const d = deps(gemini);
    await runAssistant(input, d);
    expect(d.draft).not.toHaveBeenCalled();
    expect(requests[1].contents[2].parts[0].functionResponse?.response).toEqual({ erreur: "Outil non autorisé pour cet utilisateur." });
  });
  it("runs the other calls first when repondre comes with them", async () => {
    const both: GeminiContent = { role: "model", parts: [...call("brouillon_paiement_client", {}).parts, ...final().parts] };
    const { gemini } = scripted(both, final("C'est prêt, valide."));
    const reply = await runAssistant(input, deps(gemini));
    expect(reply.texte).toBe("C'est prêt, valide.");
    expect(reply.brouillon).toEqual(PAYMENT);
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
});

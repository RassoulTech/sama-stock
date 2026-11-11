import { describe, expect, it, vi } from "vitest";
import { creerJetonDirect, DEFAULT_LIVE_MODEL, DEFAULT_LIVE_VOICE } from "./direct";

const options = {
  apiKey: "CLE",
  system: "CONSIGNES",
  tools: [{ name: "resume_ventes" as const, description: "Ventes" }],
  maintenant: new Date("2026-11-11T20:00:00Z"),
};

describe("creerJetonDirect", () => {
  it("asks Google for a single-use token that freezes the model, voice, instructions and tools", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ name: "auth_tokens/abc", expireTime: "2026-11-11T20:15:00Z" }), { status: 200 }));
    await expect(creerJetonDirect({ ...options, fetchImpl })).resolves.toEqual({ jeton: "auth_tokens/abc", modele: DEFAULT_LIVE_MODEL, expireLe: "2026-11-11T20:15:00Z" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1alpha/auth_tokens");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("CLE");
    const corps = JSON.parse(String(init.body));
    expect(corps.uses).toBe(1);
    expect(corps.expireTime).toBe("2026-11-11T20:15:00.000Z");
    expect(corps.newSessionExpireTime).toBe("2026-11-11T20:01:00.000Z");
    expect(corps.bidiGenerateContentSetup).toMatchObject({
      model: `models/${DEFAULT_LIVE_MODEL}`,
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: DEFAULT_LIVE_VOICE } } } },
      systemInstruction: { parts: [{ text: "CONSIGNES" }] },
      tools: [{ functionDeclarations: options.tools }],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    });
  });
  it("uses the configured model and voice", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ name: "auth_tokens/x" }), { status: 200 }));
    await creerJetonDirect({ ...options, model: "gemini-live-x", voice: "Puck", fetchImpl });
    const corps = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corps.bidiGenerateContentSetup.model).toBe("models/gemini-live-x");
    expect(corps.bidiGenerateContentSetup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe("Puck");
  });
  it("maps a quota answer and other refusals to errors without leaking the body", async () => {
    await expect(creerJetonDirect({ ...options, fetchImpl: vi.fn(async () => new Response("secret", { status: 429 })) })).rejects.toMatchObject({ kind: "quota" });
    await expect(creerJetonDirect({ ...options, fetchImpl: vi.fn(async () => new Response("secret", { status: 503 })) })).rejects.toMatchObject({ kind: "unavailable" });
    await expect(creerJetonDirect({ ...options, fetchImpl: vi.fn(async () => new Response("{}", { status: 200 })) })).rejects.toMatchObject({ kind: "invalid" });
  });
});

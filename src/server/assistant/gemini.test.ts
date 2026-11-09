import { describe, expect, it, vi } from "vitest";
import { createGemini, GeminiError, type GeminiRequest } from "./gemini";

const request: GeminiRequest = {
  system: "SYS",
  contents: [{ role: "user", parts: [{ text: "bonjour" }] }],
  tools: [{ name: "repondre", description: "fin" }],
};

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
}

describe("createGemini", () => {
  it("posts a forced tool call and returns the model content untouched", async () => {
    const parts = [{ functionCall: { name: "repondre", args: { texte: "ok" } }, thoughtSignature: "SIG" }];
    const fetchImpl = fakeFetch(200, { candidates: [{ content: { role: "model", parts } }] });
    const gemini = createGemini({ apiKey: "KEY", model: "gemini-test", fetchImpl });

    await expect(gemini(request)).resolves.toEqual({ role: "model", parts });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("KEY");
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction).toEqual({ parts: [{ text: "SYS" }] });
    expect(body.tools).toEqual([{ functionDeclarations: request.tools }]);
    expect(body.toolConfig).toEqual({ functionCallingConfig: { mode: "ANY" } });
  });
  it("maps 429 to a quota error", async () => {
    const gemini = createGemini({ apiKey: "K", fetchImpl: fakeFetch(429, "slow down") });
    await expect(gemini(request)).rejects.toMatchObject({ kind: "quota" });
  });
  it("maps 5xx and network failures to unavailable", async () => {
    await expect(createGemini({ apiKey: "K", fetchImpl: fakeFetch(503, "busy") })(request)).rejects.toMatchObject({ kind: "unavailable" });
    const broken = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(createGemini({ apiKey: "K", fetchImpl: broken })(request)).rejects.toMatchObject({ kind: "unavailable" });
  });
  it("maps other refusals and empty answers to invalid", async () => {
    await expect(createGemini({ apiKey: "K", fetchImpl: fakeFetch(400, "bad") })(request)).rejects.toMatchObject({ kind: "invalid" });
    await expect(createGemini({ apiKey: "K", fetchImpl: fakeFetch(200, { candidates: [] }) })(request)).rejects.toBeInstanceOf(GeminiError);
  });
  it("maps an unreadable 200 body to invalid", async () => {
    const gemini = createGemini({ apiKey: "K", fetchImpl: fakeFetch(200, "not json {") });
    await expect(gemini(request)).rejects.toMatchObject({ kind: "invalid" });
  });
  it("maps a timeout while reading the body to unavailable", async () => {
    const timedOut = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      },
      text: async () => "",
    }) as unknown as Response);
    await expect(createGemini({ apiKey: "K", fetchImpl: timedOut })(request)).rejects.toMatchObject({ kind: "unavailable" });
  });
});

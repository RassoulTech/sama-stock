import { describe, expect, it, vi } from "vitest";
import { createGemini, DEFAULT_GEMINI_MODELS, FOREIGN_SIGNATURE, GeminiError, parseModels, type GeminiContent, type GeminiRequest } from "./gemini";

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
  it("keeps the HTTP status on a refusal", async () => {
    await expect(createGemini({ apiKey: "K", fetchImpl: fakeFetch(400, "bad") })(request)).rejects.toMatchObject({ kind: "invalid", status: 400 });
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

function routedFetch(statusByModel: Record<string, number>) {
  return vi.fn(async (url: string | URL | Request) => {
    const model = /models\/([^:]+):/.exec(String(url))?.[1] ?? "";
    const status = statusByModel[model] ?? 200;
    if (status !== 200) return new Response("busy", { status });
    return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "repondre", args: {} } }] } }] }), { status });
  });
}
const modelOf = (call: unknown[]) => /models\/([^:]+):/.exec(String(call[0]))?.[1];

describe("createGemini — modèles de secours", () => {
  it("falls back to the next model when one is overloaded", async () => {
    const fetchImpl = routedFetch({ a: 503 });
    await expect(createGemini({ apiKey: "K", models: ["a", "b"], fetchImpl })(request)).resolves.toMatchObject({ role: "model" });
    expect(fetchImpl.mock.calls.map(modelOf)).toEqual(["a", "b"]);
  });
  it("falls back on quota and on a missing model", async () => {
    const fetchImpl = routedFetch({ a: 429, b: 404 });
    await createGemini({ apiKey: "K", models: ["a", "b", "c"], fetchImpl })(request);
    expect(fetchImpl.mock.calls.map(modelOf)).toEqual(["a", "b", "c"]);
  });
  it("does not fall back on a refused request (400)", async () => {
    const fetchImpl = routedFetch({ a: 400 });
    await expect(createGemini({ apiKey: "K", models: ["a", "b"], fetchImpl })(request)).rejects.toMatchObject({ kind: "invalid", status: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("keeps the model that answered for the rest of the request", async () => {
    const fetchImpl = routedFetch({ a: 503 });
    const gemini = createGemini({ apiKey: "K", models: ["a", "b"], fetchImpl });
    await gemini(request);
    await gemini(request);
    expect(fetchImpl.mock.calls.map(modelOf)).toEqual(["a", "b", "b"]);
  });
  it("throws the last error when every model fails", async () => {
    const fetchImpl = routedFetch({ a: 503, b: 503 });
    await expect(createGemini({ apiKey: "K", models: ["a", "b"], fetchImpl })(request)).rejects.toMatchObject({ kind: "unavailable", status: 503 });
  });
  it("gives up without calling Gemini once the time budget is spent", async () => {
    const fetchImpl = routedFetch({});
    await expect(createGemini({ apiKey: "K", models: ["a"], budgetMs: 0, fetchImpl })(request)).rejects.toMatchObject({ kind: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

/** Chaque modèle répond avec sa propre signature ; `script` donne les codes HTTP successifs par modèle (200 ensuite). */
function scriptedFetch(script: Record<string, number[]>) {
  return vi.fn(async (url: string | URL | Request) => {
    const model = /models\/([^:]+):/.exec(String(url))?.[1] ?? "";
    const status = script[model]?.shift() ?? 200;
    if (status !== 200) return new Response("busy", { status });
    const parts = [{ functionCall: { name: "repondre", args: {} }, thoughtSignature: `SIG-${model}` }];
    return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts } }] }), { status });
  });
}
const sentSignatures = (call: unknown[]) =>
  (JSON.parse(String((call[1] as RequestInit).body)).contents as { role: string; parts: { thoughtSignature?: string }[] }[])
    .filter((c) => c.role === "model")
    .map((c) => c.parts[0].thoughtSignature);
const answer = (name: string): GeminiContent => ({ role: "user", parts: [{ functionResponse: { name, response: {} } }] });

/** Chaque modèle répond après `delays[model]` ms (ou par le code HTTP de `statuses`), et respecte l'annulation. */
function slowFetch(delays: Record<string, number | number[]>, statuses: Record<string, number> = {}) {
  const aborted: string[] = [];
  const fetchImpl = vi.fn(
    (url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const model = /models\/([^:]+):/.exec(String(url))?.[1] ?? "";
        const planned = delays[model];
        const delay = Array.isArray(planned) ? (planned.shift() ?? 0) : (planned ?? 0);
        const status = statuses[model] ?? 200;
        const parts = [{ functionCall: { name: "repondre", args: { de: model } }, thoughtSignature: `SIG-${model}` }];
        const timer = setTimeout(
          () => resolve(status === 200 ? new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts } }] })) : new Response("x", { status })),
          delay,
        );
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          aborted.push(model);
          reject(init.signal?.reason);
        });
      }),
  );
  return { fetchImpl, aborted };
}
const fromModel = (content: GeminiContent) => content.parts[0].functionCall?.args?.de;

describe("createGemini — relais quand un modèle traîne", () => {
  it("asks the next model in parallel when the first is slow, keeps the first answer and cancels the other", async () => {
    const { fetchImpl, aborted } = slowFetch({ a: 300, b: 10 });
    const gemini = createGemini({ apiKey: "K", models: ["a", "b"], hedgeMs: 20, fetchImpl });
    expect(fromModel(await gemini(request))).toBe("b");
    expect(fetchImpl.mock.calls.map(modelOf)).toEqual(["a", "b"]);
    expect(aborted).toEqual(["a"]);
  });
  it("does not disturb a model that answers before the relay delay", async () => {
    const { fetchImpl } = slowFetch({ a: 5, b: 0 });
    const gemini = createGemini({ apiKey: "K", models: ["a", "b"], hedgeMs: 200, fetchImpl });
    expect(fromModel(await gemini(request))).toBe("a");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("starts the next call with the model that won", async () => {
    const { fetchImpl } = slowFetch({ a: 300, b: 10 });
    const gemini = createGemini({ apiKey: "K", models: ["a", "b"], hedgeMs: 20, fetchImpl });
    await gemini(request);
    await gemini(request);
    expect(fetchImpl.mock.calls.map(modelOf)).toEqual(["a", "b", "b"]);
  });
  it("still takes a running model's answer after another one refused the request", async () => {
    const { fetchImpl } = slowFetch({ a: 80, b: 0 }, { b: 400 });
    const gemini = createGemini({ apiKey: "K", models: ["a", "b", "c"], hedgeMs: 10, fetchImpl });
    expect(fromModel(await gemini(request))).toBe("a");
    expect(fetchImpl.mock.calls.map(modelOf)).toEqual(["a", "b"]);
  });
  it("relaunches a model whose connection hung, once the others have refused", async () => {
    const { fetchImpl, aborted } = slowFetch({ a: [10_000, 5] }, { b: 503 });
    const gemini = createGemini({ apiKey: "K", models: ["a", "b"], hedgeMs: 20, fetchImpl });
    expect(fromModel(await gemini(request))).toBe("a");
    expect(fetchImpl.mock.calls.map(modelOf)).toEqual(["a", "b", "a"]);
    expect(aborted).toEqual(["a"]);
  });
  it("never relaunches a model that refused", async () => {
    const fetchImpl = routedFetch({ a: 503 });
    await expect(createGemini({ apiKey: "K", models: ["a"], fetchImpl })(request)).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("cuts a model that never answers at the attempt timeout", async () => {
    const { fetchImpl } = slowFetch({ a: 10_000 });
    const gemini = createGemini({ apiKey: "K", models: ["a"], timeoutMs: 30, fetchImpl });
    await expect(gemini(request)).rejects.toMatchObject({ kind: "unavailable" });
  });
});

describe("createGemini — changement de modèle en cours de demande", () => {
  it("lets another model take over when the first one fails on a later call", async () => {
    const fetchImpl = scriptedFetch({ a: [200, 503] });
    const gemini = createGemini({ apiKey: "K", models: ["a", "b"], fetchImpl });
    const first = await gemini(request);
    await expect(gemini({ ...request, contents: [...request.contents, first, answer("repondre")] })).resolves.toMatchObject({ role: "model" });

    expect(fetchImpl.mock.calls.map(modelOf)).toEqual(["a", "a", "b"]);
    expect(sentSignatures(fetchImpl.mock.calls[1])).toEqual(["SIG-a"]);
    expect(sentSignatures(fetchImpl.mock.calls[2])).toEqual([FOREIGN_SIGNATURE]);
  });
  it("keeps each model's own signatures and replaces only the other model's", async () => {
    const fetchImpl = scriptedFetch({ a: [200, 503] });
    const gemini = createGemini({ apiKey: "K", models: ["a", "b"], fetchImpl });
    const first = await gemini(request);
    const second = await gemini({ ...request, contents: [...request.contents, first, answer("repondre")] });
    await gemini({ ...request, contents: [...request.contents, first, answer("repondre"), second, answer("repondre")] });

    expect(fetchImpl.mock.calls.map(modelOf)).toEqual(["a", "a", "b", "b"]);
    expect(sentSignatures(fetchImpl.mock.calls[3])).toEqual([FOREIGN_SIGNATURE, "SIG-b"]);
  });
  it("never changes the caller's contents", async () => {
    const fetchImpl = scriptedFetch({ a: [200, 503] });
    const gemini = createGemini({ apiKey: "K", models: ["a", "b"], fetchImpl });
    const first = await gemini(request);
    await gemini({ ...request, contents: [...request.contents, first, answer("repondre")] });
    expect(first.parts[0].thoughtSignature).toBe("SIG-a");
  });
});

describe("parseModels", () => {
  it("uses the default models when nothing is set", () => {
    expect(parseModels(undefined)).toEqual([...DEFAULT_GEMINI_MODELS]);
    expect(parseModels("  ")).toEqual([...DEFAULT_GEMINI_MODELS]);
  });
  it("puts the configured models first, then the defaults as fallbacks", () => {
    expect(parseModels("x, y")).toEqual(["x", "y", ...DEFAULT_GEMINI_MODELS]);
    expect(parseModels(DEFAULT_GEMINI_MODELS[1])).toEqual([DEFAULT_GEMINI_MODELS[1], DEFAULT_GEMINI_MODELS[0], ...DEFAULT_GEMINI_MODELS.slice(2)]);
  });
});

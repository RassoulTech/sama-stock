// Pas de "server-only" : ce fichier est testé avec Vitest et utilisé par scripts/assistant-essai.ts.
import type { FunctionDeclaration } from "@/lib/domain/assistant/tools";

/** Modèle par défaut : celui qui a gagné le test de faisabilité (tâche 6). GEMINI_MODEL le remplace. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  /** À renvoyer tel quel au tour suivant (obligatoire pour Gemini 3 et 4). */
  thoughtSignature?: string;
  thought?: boolean;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiRequest {
  system: string;
  contents: GeminiContent[];
  tools: FunctionDeclaration[];
}

export type GeminiCall = (request: GeminiRequest) => Promise<GeminiContent>;

export type GeminiErrorKind = "quota" | "unavailable" | "invalid";

export class GeminiError extends Error {
  constructor(
    readonly kind: GeminiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

/** Toute panne (abandon ou délai dépassé compris) devient une GeminiError ; le délai est toujours « unavailable ». */
function toGeminiError(error: unknown, kind: GeminiErrorKind, label: string): GeminiError {
  const name = (error as Error | undefined)?.name;
  const timedOut = name === "AbortError" || name === "TimeoutError";
  return new GeminiError(timedOut ? "unavailable" : kind, `${label} : ${(error as Error | undefined)?.message ?? String(error)}`);
}

export function createGemini(options: { apiKey: string; model?: string; timeoutMs?: number; fetchImpl?: typeof fetch }): GeminiCall {
  const { apiKey, model = DEFAULT_GEMINI_MODEL, timeoutMs = 30_000, fetchImpl = fetch } = options;
  return async ({ system, contents, tools }) => {
    let res: Response;
    try {
      res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          tools: [{ functionDeclarations: tools }],
          toolConfig: { functionCallingConfig: { mode: "ANY" } },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw toGeminiError(error, "unavailable", "Gemini injoignable");
    }
    if (res.status === 429) throw new GeminiError("quota", "Quota Gemini atteint.");
    if (res.status >= 500) throw new GeminiError("unavailable", `Gemini indisponible (${res.status}).`);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new GeminiError("invalid", `Gemini a refusé la demande (${res.status}) : ${detail.slice(0, 500)}`);
    }
    let json: { candidates?: { content?: GeminiContent }[] };
    try {
      json = (await res.json()) as typeof json;
    } catch (error) {
      throw toGeminiError(error, "invalid", "Réponse Gemini illisible");
    }
    const parts = json.candidates?.[0]?.content?.parts;
    if (!parts?.length) throw new GeminiError("invalid", "Réponse vide de Gemini.");
    return { role: "model", parts };
  };
}

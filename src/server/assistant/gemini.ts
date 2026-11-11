// Pas de "server-only" : ce fichier est testé avec Vitest et utilisé par scripts/assistant-essai.ts.
import type { FunctionDeclaration } from "@/lib/domain/assistant/tools";

/**
 * Modèles essayés dans l'ordre (mesures du 2026-11-11 en offre gratuite) : le plus rapide et le plus disponible d'abord,
 * puis des secours quand Google répond « surchargé » (503), « quota » (429) ou ne répond pas à temps.
 * gemini-3.8-flash est écarté : 503 ou plus de 45 s à chaque essai.
 */
export const DEFAULT_GEMINI_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.5-flash"] as const;
export const DEFAULT_GEMINI_MODEL = DEFAULT_GEMINI_MODELS[0];

/** Délai par essai : au-delà, on passe au modèle de secours plutôt que de faire attendre le commerçant. */
export const ATTEMPT_TIMEOUT_MS = 15_000;

/** GEMINI_MODEL (un ou plusieurs, séparés par des virgules) passe en premier ; les modèles par défaut restent en secours. */
export function parseModels(setting: string | undefined): string[] {
  const configured = (setting ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return [...new Set([...configured, ...DEFAULT_GEMINI_MODELS])];
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
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
    /** Code HTTP quand Gemini a répondu. */
    readonly status?: number,
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

/** Une panne qui justifie d'essayer le modèle suivant (surcharge, quota, délai, modèle inconnu). */
function worthFallback(error: unknown): boolean {
  return error instanceof GeminiError && (error.kind !== "invalid" || error.status === 404);
}

/**
 * Signature de remplacement documentée par Google : elle permet à un modèle de reprendre une conversation dont
 * les appels d'outils ont été produits par un autre modèle (sans elle, Gemini refuse avec une erreur 400).
 */
export const FOREIGN_SIGNATURE = "context_engineering_is_the_way_to_go";

/** Temps total accordé à une demande, secours compris : au-delà, le commerçant réessaie plutôt que d'attendre. */
export const REQUEST_BUDGET_MS = 60_000;

/** Les signatures produites par un autre modèle que `model` sont remplacées ; le reste est renvoyé tel quel. */
function signaturesFor(contents: GeminiContent[], model: string, ownerOf: ReadonlyMap<string, string>): GeminiContent[] {
  let changed = false;
  const out = contents.map((content) => {
    if (content.role !== "model") return content;
    const parts = content.parts.map((part) => {
      const owner = part.thoughtSignature ? ownerOf.get(part.thoughtSignature) : undefined;
      if (!owner || owner === model) return part;
      changed = true;
      return { ...part, thoughtSignature: FOREIGN_SIGNATURE };
    });
    return { ...content, parts };
  });
  return changed ? out : contents;
}

/** Sans réponse au bout de ce délai, le modèle suivant est interrogé en parallèle : la première réponse l'emporte. */
export const HEDGE_AFTER_MS = 5_000;

/**
 * Client Gemini avec modèles de secours, pour UNE demande du commerçant (plusieurs appels à la suite).
 * - Un modèle qui refuse (surcharge, quota, délai) passe aussitôt la main au suivant.
 * - Un modèle qui traîne au-delà de `hedgeMs` est doublé par le suivant ; la première réponse gagne, l'autre est annulée.
 * - Le modèle qui a répondu passe en premier aux appels suivants ; un autre peut reprendre la conversation grâce aux
 *   signatures de remplacement. Le tout tient dans `budgetMs`.
 */
export function createGemini(options: {
  apiKey: string;
  model?: string;
  models?: readonly string[];
  timeoutMs?: number;
  hedgeMs?: number;
  budgetMs?: number;
  fetchImpl?: typeof fetch;
}): GeminiCall {
  const { apiKey, timeoutMs = ATTEMPT_TIMEOUT_MS, hedgeMs = HEDGE_AFTER_MS, budgetMs = REQUEST_BUDGET_MS, fetchImpl = fetch } = options;
  const models = options.models?.length ? options.models : options.model ? [options.model] : DEFAULT_GEMINI_MODELS;
  const callModel = modelCaller(apiKey, fetchImpl);
  const deadline = Date.now() + budgetMs;
  /** Signature de réflexion → modèle qui l'a produite. */
  const ownerOf = new Map<string, string>();
  let chosen: string | null = null;

  return (request) =>
    new Promise<GeminiContent>((resolve, reject) => {
      const order = chosen ? [chosen, ...models.filter((m) => m !== chosen)] : [...models];
      // Deuxième tour : une connexion bloquée répond souvent vite quand on la relance. Un modèle qui a refusé
      // (surcharge, quota, inconnu) n'est pas relancé : il refuserait encore.
      const queue = [...order, ...order];
      const refused = new Set<string>();
      const running = new Set<AbortController>();
      let next = 0;
      let settled = false;
      /** Plus de nouvel essai : demande refusée telle quelle (400…) ou temps écoulé. */
      let stop = false;
      let fatal: unknown = null;
      let lastError: unknown = new GeminiError("unavailable", "Temps total dépassé pour cette demande.");
      let hedge: ReturnType<typeof setTimeout> | undefined;

      const finish = (settle: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(hedge);
        for (const controller of running) controller.abort();
        settle();
      };

      const launch = () => {
        clearTimeout(hedge);
        if (settled) return;
        const left = deadline - Date.now();
        if (left < 1_000) stop = true;
        while (next < queue.length && refused.has(queue[next])) next++;
        if (stop || next >= queue.length) {
          if (!running.size) finish(() => reject(fatal ?? lastError));
          return;
        }
        const model = queue[next++];
        const controller = new AbortController();
        running.add(controller);
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(Math.min(timeoutMs, left))]);
        callModel(model, { ...request, contents: signaturesFor(request.contents, model, ownerOf) }, signal).then(
          (content) => {
            running.delete(controller);
            if (settled) return;
            for (const part of content.parts) if (part.thoughtSignature) ownerOf.set(part.thoughtSignature, model);
            chosen = model;
            finish(() => resolve(content));
          },
          (error: unknown) => {
            running.delete(controller);
            if (settled) return;
            if (worthFallback(error)) {
              lastError = error;
              // Gemini a répondu (503, 429, 404) : ce modèle refuse. Sans code HTTP : délai ou réseau, il garde sa chance.
              if ((error as GeminiError).status) refused.add(model);
            } else {
              fatal ??= error;
              stop = true;
            }
            launch();
          },
        );
        if (next < queue.length) hedge = setTimeout(launch, hedgeMs);
      };

      launch();
    });
}

function modelCaller(apiKey: string, fetchImpl: typeof fetch) {
  return async (model: string, { system, contents, tools }: GeminiRequest, signal: AbortSignal): Promise<GeminiContent> => {
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
        signal,
      });
    } catch (error) {
      throw toGeminiError(error, "unavailable", "Gemini injoignable");
    }
    if (res.status === 429) throw new GeminiError("quota", "Quota Gemini atteint.", res.status);
    if (res.status >= 500) throw new GeminiError("unavailable", `Gemini indisponible (${res.status}).`, res.status);
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new GeminiError("invalid", `Gemini a refusé la demande (${res.status}) : ${detail.slice(0, 500)}`, res.status);
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

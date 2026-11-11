// Pas de "server-only" : testé avec Vitest.
import type { FunctionDeclaration } from "@/lib/domain/assistant/tools";
import { GeminiError } from "./gemini";

/**
 * Dialogue en direct (Gemini Live), mesuré le 2026-11-11 sur l'offre gratuite : première voix en 0,6 s, en français
 * comme en wolof. GEMINI_LIVE_MODEL et GEMINI_LIVE_VOICE permettent d'en changer.
 */
export const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";
export const DEFAULT_LIVE_VOICE = "Kore";

/** Une conversation dure au plus 15 minutes ; elle doit commencer dans la minute. */
const DUREE_SESSION_MS = 15 * 60_000;
const DELAI_OUVERTURE_MS = 60_000;

export interface JetonDirect {
  jeton: string;
  modele: string;
  expireLe: string | null;
}

/**
 * Clé temporaire à usage unique pour le téléphone. Elle fige le modèle, la voix, les consignes (donc le catalogue) et
 * les outils autorisés : le téléphone ne peut rien en changer, et la vraie clé Google reste sur le serveur.
 */
export async function creerJetonDirect(options: {
  apiKey: string;
  system: string;
  tools: FunctionDeclaration[];
  model?: string;
  voice?: string;
  maintenant?: Date;
  fetchImpl?: typeof fetch;
}): Promise<JetonDirect> {
  const { apiKey, system, tools, model = DEFAULT_LIVE_MODEL, voice = DEFAULT_LIVE_VOICE, maintenant = new Date(), fetchImpl = fetch } = options;
  let res: Response;
  try {
    res = await fetchImpl("https://generativelanguage.googleapis.com/v1alpha/auth_tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(maintenant.getTime() + DUREE_SESSION_MS).toISOString(),
        newSessionExpireTime: new Date(maintenant.getTime() + DELAI_OUVERTURE_MS).toISOString(),
        bidiGenerateContentSetup: {
          model: `models/${model}`,
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
          systemInstruction: { parts: [{ text: system }] },
          tools: [{ functionDeclarations: tools }],
          // Les transcriptions ne sont pas affichées : elles servent à savoir que le commerçant parle (fin de silence).
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GeminiError("unavailable", "Google injoignable pour ouvrir la conversation.");
  }
  if (res.status === 429) throw new GeminiError("quota", "Quota Gemini atteint.", 429);
  if (res.status >= 500) throw new GeminiError("unavailable", `Google indisponible (${res.status}).`, res.status);
  const data = (await res.json().catch(() => null)) as { name?: string; expireTime?: string } | null;
  if (!res.ok || !data?.name) throw new GeminiError("invalid", `Clé de conversation refusée (${res.status}).`, res.status);
  return { jeton: data.name, modele: model, expireLe: data.expireTime ?? null };
}

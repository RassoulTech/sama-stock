// src/lib/domain/assistant/reply.ts
import type { Draft } from "./drafts";
import type { Lang } from "./tools";

/** Un message du fil, gardé dans le téléphone et renvoyé avec la demande suivante (texte seulement). */
export interface HistoryItem {
  role: "user" | "assistant";
  text: string;
}

/** Réponse de POST /api/assistant. */
export interface AssistantReply {
  transcription: string;
  langue: Lang;
  texte: string;
  brouillon: Draft | null;
}

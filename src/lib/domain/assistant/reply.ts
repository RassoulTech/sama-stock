// src/lib/domain/assistant/reply.ts
import type { Confirmation, Mission } from "./mission";
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
  /** Ce que le téléphone doit jouer à l'écran, ou null pour une simple réponse. */
  mission: Mission | null;
  /** Pendant l'attente d'un accord : la réponse du commerçant, sinon null. */
  confirmation: Confirmation | null;
}

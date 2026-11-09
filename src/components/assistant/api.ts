// src/components/assistant/api.ts
import type { AssistantReply, HistoryItem } from "@/lib/domain/assistant/reply";

export type AskResult = { ok: true; reply: AssistantReply } | { ok: false; error: string };

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function askAssistant(audio: string, history: HistoryItem[]): Promise<AskResult> {
  try {
    const res = await fetch("/api/assistant", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ audio, history }) });
    const data = (await res.json().catch(() => null)) as (AssistantReply & { error?: string }) | null;
    if (!res.ok || !data) return { ok: false, error: data?.error ?? "L'assistant ne répond pas. Réessaie." };
    return { ok: true, reply: data };
  } catch {
    return { ok: false, error: "Pas de connexion internet." };
  }
}

/** Voix wolof (Anta), ou null si elle n'est pas disponible. */
export async function wolofVoice(texte: string): Promise<Blob | null> {
  try {
    const res = await fetch("/api/assistant/voix", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ texte }) });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/** Voix française du téléphone (gratuite, immédiate). Sans voix française installée, le navigateur choisit. */
export function speakFrench(texte: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(texte);
  utterance.lang = "fr-FR";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

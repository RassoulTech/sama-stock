// src/components/assistant/api.ts
import type { AssistantReply, HistoryItem } from "@/lib/domain/assistant/reply";

export type AskResult = { ok: true; reply: AssistantReply } | { ok: false; error: string };

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function askAssistant(audio: string, history: HistoryItem[], attente: string | null = null): Promise<AskResult> {
  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ audio, history, ...(attente ? { attente } : {}) }),
    });
    const data = (await res.json().catch(() => null)) as (AssistantReply & { error?: string }) | null;
    if (!res.ok || !data) return { ok: false, error: data?.error ?? "L'assistant ne répond pas. Réessaie." };
    return { ok: true, reply: data };
  } catch {
    return { ok: false, error: "Pas de connexion internet." };
  }
}

/** Réveille la voix wolof (le serveur gratuit s'endort) ; on n'attend pas sa réponse pour continuer. */
export async function reveillerVoix(): Promise<{ configuree: boolean; pret: boolean } | null> {
  try {
    const res = await fetch("/api/assistant/voix", { method: "GET" });
    return res.ok ? ((await res.json()) as { configuree: boolean; pret: boolean }) : null;
  } catch {
    return null;
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

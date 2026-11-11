// src/components/assistant/api.ts
import type { Mission } from "@/lib/domain/assistant/mission";

const JSON_HEADERS = { "Content-Type": "application/json" };

export type Resultat<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Clé temporaire pour une conversation en direct (une conversation compte pour une demande du jour). */
export async function demanderSession(): Promise<Resultat<{ jeton: string }>> {
  try {
    const res = await fetch("/api/assistant/session", { method: "POST", headers: JSON_HEADERS });
    const data = (await res.json().catch(() => null)) as { jeton?: string; error?: string } | null;
    if (!res.ok || !data?.jeton) return { ok: false, error: data?.error ?? "L'assistant ne répond pas. Réessaie." };
    return { ok: true, jeton: data.jeton };
  } catch {
    return { ok: false, error: "Pas de connexion internet." };
  }
}

/** Fait exécuter par le serveur un outil demandé par l'assistant (droits revérifiés, rien n'est enregistré). */
export async function executerOutilServeur(name: string, args: Record<string, unknown>): Promise<Resultat<{ reponse: Record<string, unknown>; mission: Mission | null }>> {
  try {
    const res = await fetch("/api/assistant/outil", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ name, args }) });
    const data = (await res.json().catch(() => null)) as { reponse?: Record<string, unknown>; mission?: Mission | null; error?: string } | null;
    if (!res.ok || !data?.reponse) return { ok: false, error: data?.error ?? "Le serveur n'a pas pu répondre." };
    return { ok: true, reponse: data.reponse, mission: data.mission ?? null };
  } catch {
    return { ok: false, error: "Pas de connexion internet." };
  }
}

// src/components/assistant/api.ts
import type { FicheAssistant } from "@/lib/domain/assistant/abonnement";
import type { Mission } from "@/lib/domain/assistant/mission";

const JSON_HEADERS = { "Content-Type": "application/json" };

export type Resultat<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Conversations restantes après l'ouverture (null : démonstration). */
export interface CreditsConversation {
  restants: number;
  essai: boolean;
}

export type ReponseSession =
  | { ok: true; jeton: string; credits: CreditsConversation | null }
  | { ok: false; error: string; fiche: FicheAssistant | null };

/** Clé temporaire pour une conversation en direct (un crédit retiré). Refus 402 : la fiche à montrer à la place. */
export async function demanderSession(): Promise<ReponseSession> {
  try {
    const res = await fetch("/api/assistant/session", { method: "POST", headers: JSON_HEADERS });
    const data = (await res.json().catch(() => null)) as {
      jeton?: string;
      credits?: CreditsConversation | null;
      error?: string;
      fiche?: FicheAssistant | null;
    } | null;
    if (!res.ok || !data?.jeton) return { ok: false, error: data?.error ?? "L'assistant ne répond pas. Réessaie.", fiche: data?.fiche ?? null };
    return { ok: true, jeton: data.jeton, credits: data.credits ?? null };
  } catch {
    return { ok: false, error: "Pas de connexion internet.", fiche: null };
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

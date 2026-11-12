// src/components/assistant/affichage.ts
import type { Phase } from "./assistant-provider";

/** Plein écran pour parler ; bulle en bas quand l'assistant travaille sur l'écran ; rien au repos. */
export type Affichage = "plein" | "bulle" | "rien";

export function choisirAffichage(e: {
  /** Une conversation est en cours. */
  actif: boolean;
  /** Le commerçant veut le plein écran (au départ, ou en touchant le rond de la bulle). */
  plein: boolean;
  phase: Phase;
  /** Le bouton vert à toucher est affiché. */
  geste: boolean;
  /** Un résultat ou un avertissement reste à lire après la conversation. */
  message: boolean;
}): Affichage {
  if (!e.actif) return e.message ? "bulle" : "rien";
  // Pendant une tâche, l'écran doit rester visible : la bulle seulement
  if (e.phase === "pilote" || e.phase === "confirmation" || e.geste) return "bulle";
  return e.plein ? "plein" : "bulle";
}

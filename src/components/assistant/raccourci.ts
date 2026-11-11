// src/components/assistant/raccourci.ts
/** Raccourcis clavier de l'assistant sur ordinateur : Ctrl + Espace ouvre ou ferme la conversation, Échap la ferme. */

export type Touche = Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "code" | "key" | "repeat">;

export const LIBELLE_RACCOURCI = "Ctrl + Espace";

/** Ctrl + Espace seul (pas Cmd + Espace, pris par Spotlight sur Mac), sans répétition quand on garde les touches. */
export function estRaccourciAssistant(t: Touche): boolean {
  return t.ctrlKey && !t.metaKey && !t.altKey && !t.shiftKey && !t.repeat && (t.code === "Space" || t.key === " ");
}

export function estFermetureAssistant(t: Touche): boolean {
  return t.key === "Escape" && !t.ctrlKey && !t.metaKey && !t.altKey;
}

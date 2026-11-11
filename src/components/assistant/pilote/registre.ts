// src/components/assistant/pilote/registre.ts
import type { NomPilote, Pilotes } from "./types";

/** Pilotes des écrans affichés, par nom (un seul écran de chaque sorte à la fois). */
const pilotes = new Map<NomPilote, unknown>();
const ecouteurs = new Set<() => void>();

/** Enregistre le pilote d'un écran ; la fonction rendue le retire (seulement s'il n'a pas été remplacé). */
export function enregistrerPilote<N extends NomPilote>(nom: N, pilote: Pilotes[N]): () => void {
  pilotes.set(nom, pilote);
  for (const ecouter of [...ecouteurs]) ecouter();
  return () => {
    if (pilotes.get(nom) === pilote) pilotes.delete(nom);
  };
}

export function lirePilote<N extends NomPilote>(nom: N): Pilotes[N] | null {
  return (pilotes.get(nom) as Pilotes[N] | undefined) ?? null;
}

/** Le pilote de l'écran, dès qu'il apparaît, ou null après `delaiMs`. */
export function attendrePilote<N extends NomPilote>(nom: N, delaiMs: number): Promise<Pilotes[N] | null> {
  const deja = lirePilote(nom);
  if (deja) return Promise.resolve(deja);
  return new Promise((resolve) => {
    const finir = (valeur: Pilotes[N] | null) => {
      clearTimeout(minuterie);
      ecouteurs.delete(verifier);
      resolve(valeur);
    };
    const verifier = () => {
      const pilote = lirePilote(nom);
      if (pilote) finir(pilote);
    };
    const minuterie = setTimeout(() => finir(null), delaiMs);
    ecouteurs.add(verifier);
  });
}

/** Pour les tests. */
export function viderRegistre(): void {
  pilotes.clear();
  ecouteurs.clear();
}

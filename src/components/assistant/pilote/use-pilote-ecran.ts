// src/components/assistant/pilote/use-pilote-ecran.ts
"use client";

import { useEffect, useRef } from "react";
import { enregistrerPilote } from "./registre";
import type { NomPilote, Pilotes } from "./types";

/**
 * Branche l'écran sur l'assistant pendant qu'il est affiché. Les opérations appellent toujours la version la plus
 * récente des fonctions de l'écran (donc son état à jour), sans réenregistrer le pilote à chaque rendu.
 */
export function usePiloteEcran<N extends NomPilote>(nom: N, pilote: Pilotes[N], actif = true): void {
  const courant = useRef(pilote);
  useEffect(() => {
    courant.current = pilote;
  });
  useEffect(() => {
    if (!actif) return;
    const relais = Object.fromEntries(
      Object.keys(courant.current as object).map((op) => [
        op,
        (...args: unknown[]) => (courant.current as unknown as Record<string, (...a: unknown[]) => unknown>)[op](...args),
      ]),
    ) as unknown as Pilotes[N];
    return enregistrerPilote(nom, relais);
  }, [nom, actif]);
}

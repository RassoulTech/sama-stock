// src/components/ui/garde-bulle.ts
/** Posé sur la bulle de l'assistant : la toucher ne ferme pas la fenêtre ouverte (encaissement, paiement…). */
export const ATTRIBUT_BULLE = "data-assistant-bulle";

interface Evenement {
  target: EventTarget | null;
  detail?: { originalEvent?: { target: EventTarget | null } };
}

export function dansLaBulle(event: Evenement): boolean {
  const cible = (event.detail?.originalEvent?.target ?? event.target) as { closest?: (selecteur: string) => unknown } | null;
  return typeof cible?.closest === "function" && cible.closest(`[${ATTRIBUT_BULLE}]`) != null;
}

/** Enveloppe `onPointerDownOutside` / `onInteractOutside` d'une fenêtre Radix. */
export function garderBulle<E extends { preventDefault(): void }>(suite?: (event: E) => void): (event: E) => void {
  return (event) => {
    if (dansLaBulle(event as unknown as Evenement)) {
      event.preventDefault();
      return;
    }
    suite?.(event);
  };
}

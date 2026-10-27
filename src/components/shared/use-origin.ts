import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Adresse du site (https://…) dans le navigateur ; vide au rendu serveur et à l'hydratation, sans écart de texte. */
export function useOrigin(): string {
  return useSyncExternalStore(subscribe, () => window.location.origin, () => "");
}

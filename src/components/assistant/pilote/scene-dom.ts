// src/components/assistant/pilote/scene-dom.ts
import type { ClePhrase } from "@/lib/domain/assistant/phrases";
import { DELAIS, type ReponseAccord, type Scene } from "./moteur";
import { attendrePilote } from "./registre";

export interface PositionDoigt {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function attendreQue<T>(lire: () => T | null, delaiMs: number): Promise<T | null> {
  const fin = Date.now() + delaiMs;
  for (;;) {
    const valeur = lire();
    if (valeur) return valeur;
    if (Date.now() >= fin) return null;
    await attendre(100);
  }
}

/** Le premier élément visible qui porte la cible (une même cible peut exister en version téléphone et ordinateur). */
export function trouverCible(cible: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(`[data-assistant="${CSS.escape(cible)}"]`)) {
    if (element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden") return element;
  }
  return null;
}

export function creerScene(deps: {
  router: { push(url: string): void };
  deplacerDoigt(position: PositionDoigt | null): void;
  toucher(): void;
  statut(texte: string): void;
  dire(cle: ClePhrase): void;
  demander(resume: string, signal: AbortSignal): Promise<ReponseAccord>;
}): Scene {
  return {
    async ouvrir(url) {
      const cible = new URL(url, window.location.origin);
      if (cible.pathname === window.location.pathname && cible.search === window.location.search) return true;
      deps.deplacerDoigt(null);
      deps.router.push(url);
      const arrive = await attendreQue(() => (window.location.pathname === cible.pathname ? true : null), DELAIS.pilote);
      // Le nouvel écran enregistre son pilote juste après son affichage
      if (arrive) await attendre(300);
      return Boolean(arrive);
    },
    pilote: (nom, delaiMs) => attendrePilote(nom, delaiMs),
    async pointer(cible, delaiMs) {
      const element = await attendreQue(() => trouverCible(cible), delaiMs);
      if (!element) return false;
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      await attendre(300);
      const r = element.getBoundingClientRect();
      deps.deplacerDoigt({ x: r.left + r.width / 2, y: r.top + r.height / 2, largeur: r.width, hauteur: r.height });
      await attendre(400);
      deps.toucher();
      return true;
    },
    pause: attendre,
    statut: deps.statut,
    dire: deps.dire,
    demander: deps.demander,
  };
}

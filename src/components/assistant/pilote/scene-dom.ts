// src/components/assistant/pilote/scene-dom.ts
import type { ClePhrase } from "@/lib/domain/assistant/phrases";
import { DELAIS, type ReponseAccord, type Scene } from "./moteur";
import { attendrePilote } from "./registre";
import type { Bouton } from "./boutons";

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
    if (visible(element)) return element;
  }
  return null;
}

const visible = (element: Element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";

/** La fenêtre ouverte par-dessus la page (le reste de l'écran est alors inactif), ou null. */
function fenetreOuverte(): HTMLElement | null {
  const fenetres = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')].filter(
    (f) => visible(f) && !f.closest("[data-assistant-bulle]"),
  );
  return fenetres.at(-1) ?? null;
}

const CLIQUABLES = [
  "a[href]",
  "button",
  "summary",
  '[role="button"]',
  '[role="tab"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  'input[type="submit"]',
  'input[type="button"]',
].join(", ");

function libelleDe(element: HTMLElement): string {
  const texte =
    element.getAttribute("aria-label") ||
    element.innerText ||
    element.getAttribute("title") ||
    (element instanceof HTMLInputElement ? element.value : "") ||
    "";
  return texte.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Ce qu'on peut toucher à l'écran, dans l'ordre de lecture (dans la fenêtre ouverte s'il y en a une, jamais dans la bulle). */
export function elementsCliquables(): Bouton<HTMLElement>[] {
  const racine = fenetreOuverte() ?? document.body;
  const boutons: Bouton<HTMLElement>[] = [];
  for (const element of racine.querySelectorAll<HTMLElement>(CLIQUABLES)) {
    if (element.closest("[data-assistant-bulle]") || !visible(element)) continue;
    if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") continue;
    const libelle = libelleDe(element);
    if (libelle) boutons.push({ libelle, element });
  }
  return boutons;
}

/** Un lien n'ouvre qu'une page ; un bouton d'envoi de formulaire écrit quelque chose. */
export function genreElement(element: HTMLElement): { lien: boolean; soumission: boolean } {
  const lien = element.tagName === "A" || element.getAttribute("role") === "link";
  const soumission =
    (element instanceof HTMLButtonElement && element.type === "submit" && element.form !== null) ||
    (element instanceof HTMLInputElement && element.type === "submit");
  return { lien, soumission };
}

const TEXTE_MAX = 3_500;

/** Ce que voit le commerçant : la page (ou la fenêtre ouverte) en texte, et les boutons qu'on peut toucher. */
export function lireEcran(): { page: string; titre: string; fenetre: string | null; texte: string } {
  const fenetre = fenetreOuverte();
  const zone = fenetre ?? document.querySelector<HTMLElement>("main") ?? document.body;
  const lignes: string[] = [];
  for (const ligne of zone.innerText.split("\n")) {
    const propre = ligne.replace(/\s+/g, " ").trim();
    if (propre && propre !== lignes.at(-1)) lignes.push(propre);
  }
  let texte = lignes.join("\n");
  if (texte.length > TEXTE_MAX) texte = `${texte.slice(0, TEXTE_MAX)}\n… (suite plus bas dans la page)`;
  const titre = document.querySelector("main h1")?.textContent?.trim() || document.title;
  const nomFenetre = fenetre?.querySelector("h2, [data-slot='dialog-title'], [data-slot='sheet-title']")?.textContent?.trim() ?? null;
  return { page: `${window.location.pathname}${window.location.search}`, titre, fenetre: fenetre ? (nomFenetre ?? "fenêtre ouverte") : null, texte };
}

/**
 * Appuie sur l'élément comme un doigt : certains boutons (onglets, menus, listes) réagissent à l'appui et non au clic,
 * on envoie donc toute la suite d'évènements.
 */
export function appuyer(element: HTMLElement): void {
  const r = element.getBoundingClientRect();
  const base = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  const pointeur = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true };
  element.dispatchEvent(new PointerEvent("pointerdown", { ...pointeur, buttons: 1 }));
  element.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
  element.dispatchEvent(new PointerEvent("pointerup", { ...pointeur, buttons: 0 }));
  element.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }));
  element.click();
}

/** Amène l'élément au milieu de l'écran et y pose le doigt de l'assistant. */
export async function pointerElement(
  element: HTMLElement,
  deps: { deplacerDoigt(position: PositionDoigt | null): void; toucher(): void },
): Promise<void> {
  element.scrollIntoView({ block: "center", behavior: "smooth" });
  await attendre(300);
  const r = element.getBoundingClientRect();
  deps.deplacerDoigt({ x: r.left + r.width / 2, y: r.top + r.height / 2, largeur: r.width, hauteur: r.height });
  await attendre(400);
  deps.toucher();
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
      await pointerElement(element, deps);
      return true;
    },
    pause: attendre,
    statut: deps.statut,
    dire: deps.dire,
    demander: deps.demander,
  };
}

// src/components/assistant/pilote/boutons.ts
/** Un élément qu'on peut toucher à l'écran, avec le texte qu'on y lit. */
export interface Bouton<T> {
  libelle: string;
  element: T;
}

/** Minuscules, sans accents ni ponctuation : « Valider la vente » et « valider-la vente ! » se valent. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function score(demande: string, libelle: string): number {
  if (!demande || !libelle) return 0;
  if (libelle === demande) return 4;
  if (libelle.startsWith(demande) || demande.startsWith(libelle)) return 3;
  if (demande.length >= 3 && libelle.includes(demande)) return 2;
  const mots = demande.split(" ").filter((m) => m.length > 2);
  if (mots.length > 0 && mots.every((m) => libelle.includes(m))) return 1;
  return 0;
}

/** Le bouton dont le texte correspond le mieux à la demande (le premier à l'écran en cas d'égalité), ou null. */
export function choisirBouton<T>(demande: string, boutons: readonly Bouton<T>[]): Bouton<T> | null {
  const cherche = normaliser(demande);
  let meilleur: Bouton<T> | null = null;
  let meilleurScore = 0;
  for (const bouton of boutons) {
    const s = score(cherche, normaliser(bouton.libelle));
    if (s > meilleurScore) {
      meilleur = bouton;
      meilleurScore = s;
    }
  }
  return meilleur;
}

/** Mots des boutons qui écrivent, envoient ou effacent quelque chose : l'assistant demande l'accord avant d'y toucher. */
const RISQUE =
  /supprim|annul|valid|enregistr|confirm|envoy|partag|deconnect|reinitialis|archiv|import|clotur|rembours|vider|effac|creer|generer|restaur|activer|desactiv|bloqu|revoqu|payer/;

/** Un lien ne fait qu'ouvrir une page ; un bouton qui soumet un formulaire, ou dont le texte écrit quelque chose, est risqué. */
export function estRisque(libelle: string, genre: { lien: boolean; soumission: boolean }): boolean {
  const texte = `${normaliser(libelle)} `;
  if (genre.lien) return /deconnect/.test(texte);
  return genre.soumission || RISQUE.test(texte);
}

/** Les textes des boutons, sans doublons, pour dire à l'assistant ce qu'il peut toucher. */
export function libellesUniques<T>(boutons: readonly Bouton<T>[], max = 40): string[] {
  const vus = new Set<string>();
  const libelles: string[] = [];
  for (const { libelle } of boutons) {
    const cle = normaliser(libelle);
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    libelles.push(libelle);
    if (libelles.length >= max) break;
  }
  return libelles;
}

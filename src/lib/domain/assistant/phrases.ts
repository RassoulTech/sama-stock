// src/lib/domain/assistant/phrases.ts
/** Phrases du parcours, produites une fois avec la voix Anta (public/assistant/voix) : elles se jouent tout de suite. */
export const PHRASES = {
  "je-m-en-occupe": { wo: "Waaw, maa ngi ko def.", fr: "D'accord, je m'en occupe." },
  "je-peux-enregistrer": { wo: "Ndax ma bind ko ?", fr: "Je l'enregistre ?" },
  enregistre: { wo: "Bind naa ko.", fr: "C'est enregistré." },
  laisse: { wo: "Baax na, bayyi naa ko ci écran bi.", fr: "D'accord, je le laisse à l'écran." },
  reprise: { wo: "Yaa ngi ko jël.", fr: "Tu as repris la main." },
  souci: { wo: "Am na jafe-jafe, xoolal écran bi.", fr: "Il y a un souci, regarde l'écran." },
  voici: { wo: "Mii ngi nii.", fr: "Voilà." },
} as const;

export type ClePhrase = keyof typeof PHRASES;

export function fichierPhrase(cle: ClePhrase): string {
  return `/assistant/voix/${cle}.wav`;
}

/** Morceau plus court : collé à la phrase précédente (une voix lancée pour trois lettres coûte plus qu'elle ne rapporte). */
const MIN_PHRASE = 12;

/** Découpe une réponse en phrases, pour lire la première pendant que la suivante se prépare. */
export function decouperPhrases(texte: string): string[] {
  const morceaux = texte.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const phrases: string[] = [];
  for (const brut of morceaux) {
    const morceau = brut.trim();
    if (!morceau) continue;
    const dernier = phrases.at(-1);
    if (dernier !== undefined && dernier.length < MIN_PHRASE) phrases[phrases.length - 1] = `${dernier} ${morceau}`;
    else phrases.push(morceau);
  }
  return phrases;
}

// src/lib/domain/assistant/phrases.ts
/** Moments du parcours où le pilote pourrait parler (clés de `dire`) ; en direct, c'est l'IA qui parle elle-même. */
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

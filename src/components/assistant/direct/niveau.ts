// src/components/assistant/direct/niveau.ts

/** En dessous, c'est le silence ; au-dessus de SEUIL + PLAGE, une voix forte. */
const SEUIL_DB = -50;
const PLAGE_DB = 40;

/** Niveau d'un bloc de son entre 0 (silence) et 1 (voix forte), sur une échelle en décibels, comme l'oreille. */
export function niveauSonore(echantillons: Float32Array): number {
  if (echantillons.length === 0) return 0;
  let somme = 0;
  for (const e of echantillons) somme += e * e;
  const efficace = Math.sqrt(somme / echantillons.length);
  if (efficace <= 0) return 0;
  const db = 20 * Math.log10(efficace);
  return Math.min(1, Math.max(0, (db - SEUIL_DB) / PLAGE_DB));
}

export interface Sonde {
  /** Niveau du son qui passe en ce moment (0 à 1). */
  niveau(): number;
  detacher(): void;
}

/** Une sonde posée sur un nœud audio : elle écoute sans rien changer au son. */
export function creerSonde(contexte: BaseAudioContext, entree: AudioNode): Sonde {
  const analyseur = contexte.createAnalyser();
  analyseur.fftSize = 1024;
  const bloc = new Float32Array(analyseur.fftSize);
  entree.connect(analyseur);
  return {
    niveau() {
      analyseur.getFloatTimeDomainData(bloc);
      return niveauSonore(bloc);
    },
    detacher() {
      try {
        entree.disconnect(analyseur);
      } catch {
        // déjà détachée
      }
    },
  };
}

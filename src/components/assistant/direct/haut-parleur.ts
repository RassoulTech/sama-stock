// src/components/assistant/direct/haut-parleur.ts
import { creerSonde } from "./niveau";
import { base64VersFloat32, TAUX_SORTIE } from "./protocole";

export interface HautParleur {
  /** Met un morceau de voix (PCM 24 kHz en base64) à la suite des précédents. */
  jouer(base64: string): void;
  /** Coupe net la voix en cours (le commerçant a coupé la parole). */
  vider(): void;
  /** La voix est-elle en train de sortir ? */
  parle(): boolean;
  /** Niveau de la voix qui sort (0 à 1), pour faire battre le rond. */
  niveau(): number;
  /** Débranche le lecteur (fin de la conversation). */
  fermer(): void;
}

/**
 * Lecteur de la voix reçue. Il passe par le contexte audio débloqué au toucher du micro : le son part donc même
 * plusieurs secondes après le toucher, y compris sur iPhone.
 */
export function creerHautParleur(contexte: AudioContext): HautParleur {
  let curseur = 0;
  const sources = new Set<AudioBufferSourceNode>();
  const sortie = contexte.createGain();
  sortie.connect(contexte.destination);
  const sonde = creerSonde(contexte, sortie);
  const parle = () => contexte.currentTime < curseur;
  const vider = () => {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        // déjà arrêtée
      }
    }
    sources.clear();
    curseur = 0;
  };
  return {
    jouer(base64) {
      const echantillons = base64VersFloat32(base64);
      if (!echantillons.length) return;
      const tampon = contexte.createBuffer(1, echantillons.length, TAUX_SORTIE);
      tampon.getChannelData(0).set(echantillons);
      const source = contexte.createBufferSource();
      source.buffer = tampon;
      source.connect(sortie);
      const debut = Math.max(contexte.currentTime + 0.04, curseur);
      source.start(debut);
      curseur = debut + tampon.duration;
      sources.add(source);
      source.onended = () => sources.delete(source);
    },
    vider,
    parle,
    niveau() {
      return parle() ? sonde.niveau() : 0;
    },
    fermer() {
      vider();
      sonde.detacher();
      sortie.disconnect();
    },
  };
}

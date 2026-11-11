// src/components/assistant/direct/haut-parleur.ts
import { base64VersFloat32, TAUX_SORTIE } from "./protocole";

export interface HautParleur {
  /** Met un morceau de voix (PCM 24 kHz en base64) à la suite des précédents. */
  jouer(base64: string): void;
  /** Coupe net la voix en cours (le commerçant a coupé la parole). */
  vider(): void;
  /** La voix est-elle en train de sortir ? */
  parle(): boolean;
}

/**
 * Lecteur de la voix reçue. Il passe par le contexte audio débloqué au toucher du micro : le son part donc même
 * plusieurs secondes après le toucher, y compris sur iPhone.
 */
export function creerHautParleur(contexte: AudioContext): HautParleur {
  let curseur = 0;
  const sources = new Set<AudioBufferSourceNode>();
  return {
    jouer(base64) {
      const echantillons = base64VersFloat32(base64);
      if (!echantillons.length) return;
      const tampon = contexte.createBuffer(1, echantillons.length, TAUX_SORTIE);
      tampon.getChannelData(0).set(echantillons);
      const source = contexte.createBufferSource();
      source.buffer = tampon;
      source.connect(contexte.destination);
      const debut = Math.max(contexte.currentTime + 0.04, curseur);
      source.start(debut);
      curseur = debut + tampon.duration;
      sources.add(source);
      source.onended = () => sources.delete(source);
    },
    vider() {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // déjà arrêtée
        }
      }
      sources.clear();
      curseur = 0;
    },
    parle() {
      return contexte.currentTime < curseur;
    },
  };
}

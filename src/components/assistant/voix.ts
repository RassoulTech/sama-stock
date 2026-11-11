// src/components/assistant/voix.ts
import { decouperPhrases, fichierPhrase, PHRASES, type ClePhrase } from "@/lib/domain/assistant/phrases";
import type { Lang } from "@/lib/domain/assistant/tools";
import { wolofVoice } from "./api";

export type ResultatVoix = { etat: "ok" } | { etat: "indisponible" } | { etat: "bloque"; rejouer: () => void };

export interface Voix {
  /** Phrase prête du parcours : fichier Anta en wolof, voix du téléphone en français. */
  phrase(cle: ClePhrase, langue: Lang): Promise<void>;
  /** Réponse libre ; en wolof, phrase par phrase (la suivante se prépare pendant la lecture). */
  dire(texte: string, langue: Lang): Promise<ResultatVoix>;
  couper(): void;
}

function jouerAudio(audio: HTMLAudioElement): Promise<"fin" | "bloque"> {
  return new Promise((resolve) => {
    audio.onended = () => resolve("fin");
    audio.onerror = () => resolve("fin");
    audio.play().catch(() => resolve("bloque"));
  });
}

function parlerFrancais(texte: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const enonce = new SpeechSynthesisUtterance(texte);
    enonce.lang = "fr-FR";
    const voix = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
    if (voix) enonce.voice = voix;
    enonce.onend = () => resolve();
    enonce.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(enonce);
  });
}

export function creerVoix(): Voix {
  let courant: HTMLAudioElement | null = null;
  /** Chaque nouvelle parole interrompt la précédente. */
  let generation = 0;

  function couper() {
    generation++;
    courant?.pause();
    courant = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  return {
    couper,
    async phrase(cle, langue) {
      couper();
      if (langue === "fr") return parlerFrancais(PHRASES[cle].fr);
      const audio = new Audio(fichierPhrase(cle));
      courant = audio;
      await jouerAudio(audio);
    },
    async dire(texte, langue) {
      couper();
      const moi = generation;
      if (langue === "fr") {
        await parlerFrancais(texte);
        return { etat: "ok" };
      }
      const phrases = decouperPhrases(texte);
      let prochaine = phrases.length ? wolofVoice(phrases[0]) : null;
      for (let i = 0; i < phrases.length && prochaine; i++) {
        const son = await prochaine;
        if (moi !== generation) return { etat: "ok" };
        if (!son) return i === 0 ? { etat: "indisponible" } : { etat: "ok" };
        prochaine = i + 1 < phrases.length ? wolofVoice(phrases[i + 1]) : null;
        const url = URL.createObjectURL(son);
        const audio = new Audio(url);
        courant = audio;
        if ((await jouerAudio(audio)) === "bloque") return { etat: "bloque", rejouer: () => void new Audio(url).play() };
        if (moi !== generation) return { etat: "ok" };
      }
      return { etat: "ok" };
    },
  };
}

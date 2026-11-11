// src/components/assistant/direct/conversation.ts
import { demanderSession } from "../api";
import { creerHautParleur } from "./haut-parleur";
import { ouvrirMicro, type Micro } from "./micro";
import {
  lireMessage,
  messageAudio,
  messageDemarrage,
  messageReponseOutil,
  messageTexte,
  pcmVersBase64,
  urlDirect,
  type AppelOutil,
  type EvenementServeur,
} from "./protocole";

export type EtatConversation = "connexion" | "ecoute" | "parle" | "outil";

export interface OptionsConversation {
  /** Contexte audio créé et débloqué dans le toucher du micro. */
  contexte: AudioContext;
  surEtat(etat: EtatConversation): void;
  surOutils(appels: AppelOutil[]): void;
  surOutilsAnnules(ids: string[]): void;
  /** Fin de la conversation, avec la raison à montrer (null : fin normale). */
  surFin(raison: string | null): void;
}

export interface Conversation {
  repondreOutil(id: string, name: string, reponse: Record<string, unknown>): void;
  /** Note pour l'assistant (ex. résultat d'un bouton) ; il y répond à voix haute. */
  noter(texte: string): void;
  /** Coupe la parole de l'assistant (toucher la bulle). */
  couperParole(): void;
  terminer(raison?: string | null): void;
}

/** Sans parole pendant ce temps, la conversation s'arrête (pour ne pas laisser le micro ouvert). */
const SILENCE_MAX_MS = 90_000;
/** Le micro reprend un peu après la fin de la voix, pour ne pas envoyer la fin de son écho. */
const MARGE_APRES_VOIX_MS = 350;

declare global {
  interface Window {
    /** Journal d'essai : s'il existe (créé à la main dans la console), la conversation y note ses évènements. */
    __journalAssistant?: unknown[];
  }
}

/**
 * Conversation en direct : micro → Google en continu, voix ← Google au fil de l'eau. Google détecte la fin de
 * parole ; pendant que l'assistant parle, le micro n'est pas envoyé (il ne s'entend pas lui-même).
 */
export function creerConversation(o: OptionsConversation): Conversation {
  const haut = creerHautParleur(o.contexte);
  let ws: WebSocket | null = null;
  let micro: Micro | null = null;
  let finie = false;
  let finVoix = 0;
  let derniereActivite = Date.now();
  let enAttente = 0;
  let surveillance: ReturnType<typeof setInterval> | null = null;
  let verifParole: ReturnType<typeof setTimeout> | null = null;
  /** Après « couper la parole », le reste de la phrase en cours n'est plus joué. */
  let ignorerVoix = false;

  const noter = (e: unknown) => {
    if (typeof window !== "undefined" && Array.isArray(window.__journalAssistant)) window.__journalAssistant.push(e);
  };
  const envoyer = (message: string) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(message);
  };

  function terminer(raison: string | null = null) {
    if (finie) return;
    finie = true;
    if (surveillance) clearInterval(surveillance);
    if (verifParole) clearTimeout(verifParole);
    micro?.fermer();
    haut.vider();
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000);
    noter({ fin: raison });
    o.surFin(raison);
  }

  function attendreFinVoix() {
    if (verifParole) clearTimeout(verifParole);
    verifParole = setTimeout(() => {
      if (finie) return;
      if (haut.parle()) return attendreFinVoix();
      finVoix = Date.now();
      if (!enAttente) o.surEtat("ecoute");
    }, 150);
  }

  function envoyerMorceau(pcm: Int16Array) {
    if (finie || haut.parle() || Date.now() - finVoix < MARGE_APRES_VOIX_MS) return;
    envoyer(messageAudio(pcmVersBase64(pcm)));
  }

  async function traiter(e: EvenementServeur) {
    noter(e.type === "audio" ? { type: "audio" } : e);
    switch (e.type) {
      case "pret":
        try {
          micro = await ouvrirMicro(o.contexte, envoyerMorceau);
        } catch {
          terminer("Le micro est bloqué. Autorise-le : touche le cadenas à côté de l'adresse, puis Micro → Autoriser.");
          return;
        }
        if (finie) micro.fermer();
        else o.surEtat("ecoute");
        return;
      case "audio":
        derniereActivite = Date.now();
        if (ignorerVoix) return;
        haut.jouer(e.donnees);
        o.surEtat("parle");
        return;
      case "interrompu":
        haut.vider();
        attendreFinVoix();
        return;
      case "fin-de-tour":
        ignorerVoix = false;
        attendreFinVoix();
        return;
      case "outils":
        derniereActivite = Date.now();
        enAttente += e.appels.length;
        o.surEtat("outil");
        o.surOutils(e.appels);
        return;
      case "outils-annules":
        enAttente = Math.max(0, enAttente - e.ids.length);
        o.surOutilsAnnules(e.ids);
        return;
      case "transcription":
        if (e.qui === "commercant") derniereActivite = Date.now();
        return;
      case "depart":
        terminer("La conversation a atteint sa durée maximale. Touche le micro pour en commencer une autre.");
        return;
      case "erreur":
        terminer("L'assistant a rencontré un problème. Touche le micro pour recommencer.");
        return;
    }
  }

  void (async () => {
    o.surEtat("connexion");
    const session = await demanderSession();
    if (finie) return;
    if (!session.ok) return terminer(session.error);
    ws = new WebSocket(urlDirect(session.jeton));
    ws.binaryType = "arraybuffer";
    ws.onopen = () => envoyer(messageDemarrage());
    ws.onmessage = (ev: MessageEvent<string | ArrayBuffer>) => {
      const brut = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data);
      for (const e of lireMessage(brut)) void traiter(e);
    };
    ws.onclose = (ev) => {
      noter({ fermeture: ev.code, raison: ev.reason });
      if (!finie) terminer(ev.code === 1000 ? null : "La conversation s'est coupée. Touche le micro pour recommencer.");
    };
    surveillance = setInterval(() => {
      if (!enAttente && !haut.parle() && Date.now() - derniereActivite > SILENCE_MAX_MS) terminer(null);
    }, 5_000);
  })();

  return {
    repondreOutil(id, name, reponse) {
      enAttente = Math.max(0, enAttente - 1);
      noter({ reponseOutil: name, reponse });
      envoyer(messageReponseOutil(id, name, reponse));
    },
    noter(texte) {
      derniereActivite = Date.now();
      noter({ note: texte });
      envoyer(messageTexte(texte));
    },
    couperParole() {
      if (!haut.parle()) return;
      ignorerVoix = true;
      haut.vider();
      attendreFinVoix();
    },
    terminer,
  };
}

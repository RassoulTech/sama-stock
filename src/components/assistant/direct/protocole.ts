// src/components/assistant/direct/protocole.ts
/** Messages du dialogue en direct (Gemini Live) : lecture de ce que Google envoie, fabrication de ce qu'on lui envoie. */

export interface AppelOutil {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type EvenementServeur =
  | { type: "pret" }
  | { type: "audio"; donnees: string }
  | { type: "interrompu" }
  | { type: "fin-de-tour" }
  | { type: "outils"; appels: AppelOutil[] }
  | { type: "outils-annules"; ids: string[] }
  | { type: "transcription"; qui: "commercant" | "assistant"; texte: string }
  | { type: "depart" }
  | { type: "erreur"; message: string };

const ENTREE_AUDIO = "audio/pcm;rate=16000";
export const TAUX_ENTREE = 16_000;
export const TAUX_SORTIE = 24_000;

export function urlDirect(jeton: string): string {
  return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(jeton)}`;
}

interface MessageBrut {
  setupComplete?: unknown;
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string } }[] };
    outputTranscription?: { text?: string };
    inputTranscription?: { text?: string };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  toolCall?: { functionCalls?: { id?: string; name?: string; args?: Record<string, unknown> }[] };
  toolCallCancellation?: { ids?: string[] };
  goAway?: unknown;
  error?: { message?: string };
}

/** Un message de Google peut porter plusieurs choses à la fois (voix + transcription + fin de tour). */
export function lireMessage(brut: string): EvenementServeur[] {
  let msg: MessageBrut;
  try {
    msg = JSON.parse(brut) as MessageBrut;
  } catch {
    return [{ type: "erreur", message: "Message illisible." }];
  }
  const evenements: EvenementServeur[] = [];
  if (msg.setupComplete) evenements.push({ type: "pret" });
  const contenu = msg.serverContent;
  if (contenu) {
    if (contenu.interrupted) evenements.push({ type: "interrompu" });
    for (const part of contenu.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) evenements.push({ type: "audio", donnees: part.inlineData.data });
    }
    if (contenu.outputTranscription?.text) evenements.push({ type: "transcription", qui: "assistant", texte: contenu.outputTranscription.text });
    if (contenu.inputTranscription?.text) evenements.push({ type: "transcription", qui: "commercant", texte: contenu.inputTranscription.text });
    if (contenu.turnComplete) evenements.push({ type: "fin-de-tour" });
  }
  const appels = msg.toolCall?.functionCalls;
  if (appels?.length) {
    evenements.push({
      type: "outils",
      appels: appels.flatMap((a) => (a.id && a.name ? [{ id: a.id, name: a.name, args: a.args ?? {} }] : [])),
    });
  }
  if (msg.toolCallCancellation?.ids?.length) evenements.push({ type: "outils-annules", ids: msg.toolCallCancellation.ids });
  if (msg.goAway) evenements.push({ type: "depart" });
  if (msg.error) evenements.push({ type: "erreur", message: msg.error.message ?? "Erreur de Google." });
  return evenements;
}

/** La clé temporaire fixe déjà le modèle, la voix, les consignes et les outils : la mise en place est vide. */
export function messageDemarrage(): string {
  return JSON.stringify({ setup: {} });
}

export function messageAudio(base64: string): string {
  return JSON.stringify({ realtimeInput: { audio: { data: base64, mimeType: ENTREE_AUDIO } } });
}

export function messageReponseOutil(id: string, name: string, response: Record<string, unknown>): string {
  return JSON.stringify({ toolResponse: { functionResponses: [{ id, name, response }] } });
}

/** Une note pour l'assistant (ex. le commerçant a appuyé sur Oui) : il y répond à voix haute. */
export function messageTexte(texte: string): string {
  return JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text: texte }] }], turnComplete: true } });
}

/** Son du micro (souvent 48 kHz, en nombres de -1 à 1) → PCM 16 bits à 16 kHz, comme Google l'attend. */
export function versPcm16(source: Float32Array, tauxSource: number): Int16Array {
  const rapport = tauxSource / TAUX_ENTREE;
  const longueur = Math.floor(source.length / rapport);
  const pcm = new Int16Array(longueur);
  for (let i = 0; i < longueur; i++) {
    // Moyenne des échantillons regroupés : évite le grésillement d'un simple sous-échantillonnage
    const debut = Math.floor(i * rapport);
    const fin = Math.max(debut + 1, Math.floor((i + 1) * rapport));
    let somme = 0;
    for (let j = debut; j < fin; j++) somme += source[j];
    const s = Math.max(-1, Math.min(1, somme / (fin - debut)));
    pcm[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return pcm;
}

export function pcmVersBase64(pcm: Int16Array): string {
  const octets = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

/** Voix reçue (PCM 16 bits petit-boutiste, base64) → nombres de -1 à 1 pour le lecteur. */
export function base64VersFloat32(base64: string): Float32Array {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  const vue = new DataView(octets.buffer);
  const sortie = new Float32Array(Math.floor(octets.length / 2));
  for (let i = 0; i < sortie.length; i++) sortie[i] = vue.getInt16(i * 2, true) / 0x8000;
  return sortie;
}

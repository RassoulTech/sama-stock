// src/components/assistant/direct/micro.ts
import { creerSonde } from "./niveau";
import { versPcm16 } from "./protocole";

/** Petit module joué dans le fil audio du navigateur : il recopie chaque bloc du micro vers la page. */
const CAPTEUR = `class CapteurAssistant extends AudioWorkletProcessor {
  process(entrees) {
    const canal = entrees[0] && entrees[0][0];
    if (canal) this.port.postMessage(canal.slice(0));
    return true;
  }
}
registerProcessor("capteur-assistant", CapteurAssistant);`;

/** Un morceau de son part toutes les 100 ms environ. */
const MORCEAU_MS = 100;
const modulesCharges = new WeakSet<BaseAudioContext>();

export interface Micro {
  /** Niveau de la voix captée (0 à 1). */
  niveau(): number;
  fermer(): void;
}

/** Ouvre le micro et rend des morceaux PCM 16 bits à 16 kHz. Échoue si le micro est refusé ou absent. */
export async function ouvrirMicro(contexte: AudioContext, surMorceau: (pcm: Int16Array) => void): Promise<Micro> {
  const flux = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const source = contexte.createMediaStreamSource(flux);
  const taille = Math.round((contexte.sampleRate * MORCEAU_MS) / 1000);
  let tampon = new Float32Array(0);
  const recevoir = (bloc: Float32Array) => {
    const joint = new Float32Array(tampon.length + bloc.length);
    joint.set(tampon);
    joint.set(bloc, tampon.length);
    tampon = joint;
    while (tampon.length >= taille) {
      surMorceau(versPcm16(tampon.subarray(0, taille), contexte.sampleRate));
      tampon = tampon.slice(taille);
    }
  };

  // Le nœud doit être relié à la sortie pour être lu ; un volume nul évite tout retour dans le haut-parleur.
  const muet = contexte.createGain();
  muet.gain.value = 0;
  muet.connect(contexte.destination);
  let noeud: AudioNode;
  let detacher: () => void;
  if (contexte.audioWorklet) {
    if (!modulesCharges.has(contexte)) {
      const url = URL.createObjectURL(new Blob([CAPTEUR], { type: "application/javascript" }));
      try {
        await contexte.audioWorklet.addModule(url);
        modulesCharges.add(contexte);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    const worklet = new AudioWorkletNode(contexte, "capteur-assistant");
    worklet.port.onmessage = (e: MessageEvent<Float32Array>) => recevoir(e.data);
    noeud = worklet;
    detacher = () => {
      worklet.port.onmessage = null;
    };
  } else {
    // Vieux navigateurs : ScriptProcessor, déprécié mais encore présent partout
    const processeur = contexte.createScriptProcessor(4096, 1, 1);
    processeur.onaudioprocess = (e) => recevoir(new Float32Array(e.inputBuffer.getChannelData(0)));
    noeud = processeur;
    detacher = () => {
      processeur.onaudioprocess = null;
    };
  }
  source.connect(noeud);
  noeud.connect(muet);
  const sonde = creerSonde(contexte, source);

  return {
    niveau: () => sonde.niveau(),
    fermer() {
      detacher();
      sonde.detacher();
      source.disconnect();
      noeud.disconnect();
      muet.disconnect();
      flux.getTracks().forEach((t) => t.stop());
    },
  };
}

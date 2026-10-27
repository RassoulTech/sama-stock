/**
 * Sons des notifications, fabriqués par le navigateur (Web Audio) : aucun fichier à télécharger.
 * Un son par type : tiroir-caisse pour une vente, carillon pour une commande, bip d'alerte pour le stock.
 */
export type SoundKind = "sale" | "order" | "stock";

export function soundOf(kind: string): SoundKind {
  return kind === "sale" ? "sale" : kind === "order" ? "order" : "stock";
}

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

/** À appeler lors d'un toucher : les navigateurs ne jouent un son qu'après un geste de la personne sur la page. */
export function unlockSound() {
  const a = audio();
  if (a && a.state === "suspended") void a.resume().catch(() => {});
}

function tone(a: AudioContext, o: { freq: number; start: number; duration: number; type?: OscillatorType; gain?: number }) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, o.start);
  gain.gain.setValueAtTime(0.0001, o.start);
  gain.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, o.start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, o.start + o.duration);
  osc.connect(gain).connect(a.destination);
  osc.start(o.start);
  osc.stop(o.start + o.duration + 0.05);
}

export function playSound(kind: SoundKind) {
  const a = audio();
  if (!a) return;
  if (a.state === "suspended") void a.resume().catch(() => {});
  const t = a.currentTime + 0.03;
  if (kind === "sale") {
    // Tiroir-caisse : un petit « clac », puis deux pièces claires
    tone(a, { freq: 160, start: t, duration: 0.07, type: "square", gain: 0.07 });
    for (const [freq, delay] of [
      [1568, 0.06],
      [2093, 0.16],
    ] as const) {
      tone(a, { freq, start: t + delay, duration: 0.55, type: "triangle", gain: 0.22 });
      tone(a, { freq: freq * 2.76, start: t + delay, duration: 0.22, gain: 0.05 });
    }
  } else if (kind === "order") {
    // Carillon : trois notes qui montent
    [523.25, 659.25, 783.99].forEach((freq, i) => tone(a, { freq, start: t + i * 0.14, duration: 0.7, gain: 0.2 }));
  } else {
    // Alerte : deux bips qui descendent, deux fois
    for (const offset of [0, 0.45]) {
      tone(a, { freq: 880, start: t + offset, duration: 0.15, type: "square", gain: 0.08 });
      tone(a, { freq: 660, start: t + offset + 0.18, duration: 0.2, type: "square", gain: 0.08 });
    }
  }
}

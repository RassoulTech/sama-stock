// src/components/assistant/assistant-provider.tsx
"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { dansLaBulle } from "@/components/ui/garde-bulle";
import { missionForModel, type Mission } from "@/lib/domain/assistant/mission";
import type { AssistantReply, HistoryItem } from "@/lib/domain/assistant/reply";
import type { Lang } from "@/lib/domain/assistant/tools";
import { askAssistant, reveillerVoix } from "./api";
import { jouer, type FinMission, type ReponseAccord } from "./pilote/moteur";
import { etapesPour } from "./pilote/recettes";
import { creerScene, type PositionDoigt } from "./pilote/scene-dom";
import { MAX_RECORDING_MS, MIN_RECORDING_MS, startRecording, toBase64, toWav16k, type Recording } from "./recorder";
import { creerVoix } from "./voix";

export type Phase = "idle" | "recording" | "thinking" | "speaking" | "pilote" | "confirmation";

export const STATUTS: Record<Phase, string> = {
  idle: "Garde le doigt appuyé et parle, en wolof ou en français.",
  recording: "Je t'écoute… relâche quand tu as fini.",
  thinking: "Je réfléchis…",
  speaking: "Je te réponds…",
  pilote: "Je fais la tâche à l'écran…",
  confirmation: "Je l'enregistre ?",
};

export interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface AssistantValue {
  ouvert: boolean;
  setOuvert: (ouvert: boolean) => void;
  phase: Phase;
  turns: Turn[];
  notice: string | null;
  statut: string | null;
  resume: string | null;
  doigt: PositionDoigt | null;
  touche: number;
  rejouer: (() => void) | null;
  appuyer: () => void;
  relacher: () => void;
  accord: (oui: boolean) => void;
  arreter: () => void;
  fermerStatut: () => void;
}

const AssistantContext = createContext<AssistantValue | null>(null);

export function useAssistant(): AssistantValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant doit être utilisé dans AssistantProvider.");
  return value;
}

/** Après une mission, le résultat reste dans la bulle quelques secondes. */
const STATUT_MS = 5_000;
/** Un réveil de la voix au plus toutes les 10 minutes. */
const REVEIL_MS = 10 * 60_000;

/** État de l'assistant pour toute l'application : il survit à la fermeture du panneau et aux changements de page. */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ouvert, setOuvertEtat] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const [resume, setResume] = useState<string | null>(null);
  const [doigt, setDoigt] = useState<PositionDoigt | null>(null);
  const [touche, setTouche] = useState(0);
  const [rejouer, setRejouer] = useState<(() => void) | null>(null);
  const [voix] = useState(creerVoix);

  const langue = useRef<Lang>("fr");
  const turnsRef = useRef<Turn[]>([]);
  const pressed = useRef(false);
  const starting = useRef(false);
  const recording = useRef<{ rec: Recording; startedAt: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const controle = useRef<AbortController | null>(null);
  const attente = useRef<{ mission: Mission; resoudre: (reponse: ReponseAccord) => void } | null>(null);
  const missionCourante = useRef<Mission | null>(null);
  const dernierReveil = useRef(0);
  const voixEnReveil = useRef(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  // Départ de l'application : micro libéré, voix coupée, mission arrêtée.
  useEffect(() => {
    const rec = recording;
    const c = controle;
    return () => {
      if (rec.current) {
        clearTimeout(rec.current.timer);
        rec.current.rec.cancel();
      }
      c.current?.abort();
      voix.couper();
    };
  }, [voix]);

  // Toucher la page pendant une mission = reprendre la main (la bulle ne compte pas).
  useEffect(() => {
    if (phase !== "pilote" && phase !== "confirmation") return;
    const surToucher = (event: PointerEvent) => {
      if (!dansLaBulle({ target: event.target })) controle.current?.abort();
    };
    document.addEventListener("pointerdown", surToucher, true);
    return () => document.removeEventListener("pointerdown", surToucher, true);
  }, [phase]);

  function montrerStatut(texte: string | null, garder = false) {
    if (minuterie.current) clearTimeout(minuterie.current);
    setStatut(texte);
    if (texte && !garder) minuterie.current = setTimeout(() => setStatut(null), STATUT_MS);
  }

  function addTurns(...items: Omit<Turn, "id">[]) {
    setTurns((t) => [...t, ...items.map((item) => ({ ...item, id: crypto.randomUUID() }))]);
  }

  const scene = useMemo(
    () =>
      creerScene({
        router,
        deplacerDoigt: setDoigt,
        toucher: () => setTouche((n) => n + 1),
        statut: (texte) => {
          if (minuterie.current) clearTimeout(minuterie.current);
          setStatut(texte);
        },
        dire: (cle) => void voix.phrase(cle, langue.current),
        demander: (texte, signal) =>
          new Promise<ReponseAccord>((resolve) => {
            const finir = (reponse: ReponseAccord) => {
              if (attente.current?.resoudre !== finir) return;
              attente.current = null;
              setResume(null);
              setPhase("pilote");
              resolve(reponse);
            };
            attente.current = { mission: missionCourante.current!, resoudre: finir };
            setResume(texte);
            setPhase("confirmation");
            signal.addEventListener("abort", () => finir({ type: "non" }), { once: true });
          }),
      }),
    [router, voix],
  );

  async function parler(texte: string, l: Lang) {
    setRejouer(null);
    const resultat = await voix.dire(texte, l);
    if (resultat.etat === "bloque") setRejouer(() => resultat.rejouer);
    if (resultat.etat === "indisponible") {
      setNotice(
        voixEnReveil.current
          ? "La voix wolof se réveille, elle revient dans quelques minutes : la réponse est écrite."
          : "Voix wolof indisponible pour le moment : la réponse est écrite.",
      );
    }
  }

  async function lancer(mission: Mission, texte: string): Promise<void> {
    setOuvertEtat(false);
    setNotice(null);
    setPhase("pilote");
    missionCourante.current = mission;
    const c = new AbortController();
    controle.current = c;
    if (mission.type === "tache") void voix.phrase("je-m-en-occupe", langue.current);
    let fin: FinMission;
    try {
      fin = await jouer(etapesPour(mission), scene, c.signal);
    } catch {
      fin = { etat: "arrete", raison: "ecran" };
    }
    controle.current = null;
    setDoigt(null);
    if (fin.etat === "corrige") return lancer(fin.mission, texte);
    missionCourante.current = null;
    switch (fin.etat) {
      case "enregistre":
        montrerStatut(fin.message);
        addTurns({ role: "assistant", text: `✓ ${fin.message}` });
        break;
      case "refuse":
        montrerStatut(fin.message);
        setNotice(fin.message);
        break;
      case "laisse":
        montrerStatut("D'accord, l'écran reste rempli : tu peux corriger et enregistrer toi-même.");
        break;
      case "arrete":
        if (fin.raison === "reprise") {
          void voix.phrase("reprise", langue.current);
          montrerStatut("Tu as repris la main.");
        } else {
          void voix.phrase("souci", langue.current);
          montrerStatut("L'écran ne répond pas : rien n'est enregistré.");
        }
        break;
      case "montre":
        montrerStatut(texte);
        setPhase("speaking");
        await parler(texte, langue.current);
        break;
    }
    setPhase("idle");
  }

  async function traiter(reply: AssistantReply) {
    langue.current = reply.langue;
    addTurns({ role: "user", text: reply.transcription || "…" }, { role: "assistant", text: reply.texte });
    const enAttente = attente.current;
    if (enAttente) {
      if (reply.confirmation) return enAttente.resoudre({ type: reply.confirmation });
      if (reply.mission?.type === "tache") return enAttente.resoudre({ type: "correction", mission: reply.mission });
      setPhase("confirmation");
      void parler(reply.texte, reply.langue);
      return;
    }
    if (reply.mission) return lancer(reply.mission, reply.texte);
    setPhase("speaking");
    await parler(reply.texte, reply.langue);
    setPhase("idle");
  }

  async function demarrer() {
    if (recording.current || starting.current || phase === "thinking" || phase === "pilote") return;
    starting.current = true;
    setNotice(null);
    voix.couper();
    try {
      const rec = await startRecording();
      recording.current = { rec, startedAt: Date.now(), timer: setTimeout(() => void finEnregistrement(), MAX_RECORDING_MS) };
      setPhase("recording");
      if (!pressed.current) void finEnregistrement();
    } catch {
      setNotice("Le micro est bloqué. Autorise-le : touche le cadenas à côté de l'adresse, puis Micro → Autoriser.");
    } finally {
      starting.current = false;
    }
  }

  async function finEnregistrement() {
    pressed.current = false;
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    clearTimeout(current.timer);
    const blob = await current.rec.stop();
    const retour: Phase = attente.current ? "confirmation" : "idle";
    if (Date.now() - current.startedAt < MIN_RECORDING_MS || blob.size === 0) {
      setPhase(retour);
      setNotice("Je n'ai rien entendu. Garde le doigt appuyé pendant que tu parles.");
      return;
    }
    setPhase("thinking");
    let audio: string;
    try {
      audio = toBase64(await toWav16k(blob));
    } catch {
      setPhase(retour);
      setNotice("Impossible de lire l'enregistrement. Réessaie.");
      return;
    }
    const history: HistoryItem[] = turnsRef.current.slice(-10).map(({ role, text }) => ({ role, text: text.slice(0, 800) }));
    const enAttente = attente.current;
    const res = await askAssistant(audio, history, enAttente ? missionForModel(enAttente.mission) : null);
    if (!res.ok) {
      setPhase(attente.current ? "confirmation" : "idle");
      setNotice(res.error);
      return;
    }
    await traiter(res.reply);
  }

  function setOuvert(valeur: boolean) {
    setOuvertEtat(valeur);
    if (valeur && Date.now() - dernierReveil.current > REVEIL_MS) {
      dernierReveil.current = Date.now();
      void reveillerVoix().then((r) => {
        voixEnReveil.current = Boolean(r?.configuree && !r.pret);
      });
    }
  }

  const value: AssistantValue = {
    ouvert,
    setOuvert,
    phase,
    turns,
    notice,
    statut,
    resume,
    doigt,
    touche,
    rejouer,
    appuyer: () => {
      pressed.current = true;
      void demarrer();
    },
    relacher: () => {
      if (!pressed.current) return;
      pressed.current = false;
      void finEnregistrement();
    },
    accord: (oui) => attente.current?.resoudre({ type: oui ? "oui" : "non" }),
    arreter: () => controle.current?.abort(),
    fermerStatut: () => montrerStatut(null),
  };

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

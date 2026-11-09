"use client";

import { Mic, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Draft } from "@/lib/domain/assistant/drafts";
import type { AssistantReply, HistoryItem } from "@/lib/domain/assistant/reply";
import { cn } from "@/lib/utils";
import { askAssistant, speakFrench, wolofVoice } from "./api";
import { DraftCard } from "./draft-card";
import { MAX_RECORDING_MS, MIN_RECORDING_MS, startRecording, toBase64, toWav16k, type Recording } from "./recorder";

type Phase = "idle" | "recording" | "thinking" | "speaking";

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  draft?: Draft | null;
}

const STATUS: Record<Phase, string> = {
  idle: "Garde le doigt appuyé et parle, en wolof ou en français.",
  recording: "Je t'écoute… relâche quand tu as fini.",
  thinking: "Je réfléchis…",
  speaking: "Je prépare la voix…",
};

export function AssistantPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const pressed = useRef(false);
  const mounted = useRef(false);
  const recording = useRef<{ rec: Recording; startedAt: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  // Fermeture du panneau : on libère le micro et on coupe le son.
  useEffect(() => {
    const rec = recording;
    const audio = player;
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (rec.current) {
        clearTimeout(rec.current.timer);
        rec.current.rec.cancel();
        rec.current = null;
      }
      audio.current?.pause();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function addTurns(...items: Omit<Turn, "id">[]) {
    setTurns((t) => [...t, ...items.map((item) => ({ ...item, id: crypto.randomUUID() }))]);
  }

  async function start() {
    if (phase !== "idle" || recording.current) return;
    setNotice(null);
    player.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    try {
      const rec = await startRecording();
      recording.current = { rec, startedAt: Date.now(), timer: setTimeout(() => void stop(), MAX_RECORDING_MS) };
      setPhase("recording");
      if (!pressed.current) void stop();
    } catch {
      setNotice("Le micro est bloqué. Autorise-le : touche le cadenas à côté de l'adresse, puis Micro → Autoriser.");
    }
  }

  async function stop() {
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    clearTimeout(current.timer);
    const blob = await current.rec.stop();
    if (!mounted.current) return;
    if (Date.now() - current.startedAt < MIN_RECORDING_MS || blob.size === 0) {
      setPhase("idle");
      setNotice("Je n'ai rien entendu. Garde le doigt appuyé pendant que tu parles.");
      return;
    }
    setPhase("thinking");
    let audio: string;
    try {
      const wav = await toWav16k(blob);
      if (!mounted.current) return;
      audio = toBase64(wav);
    } catch {
      setPhase("idle");
      setNotice("Impossible de lire l'enregistrement. Réessaie.");
      return;
    }
    const history: HistoryItem[] = turns.slice(-10).map(({ role, text }) => ({ role, text }));
    const res = await askAssistant(audio, history);
    if (!mounted.current) return;
    if (!res.ok) {
      setPhase("idle");
      setNotice(res.error);
      return;
    }
    addTurns({ role: "user", text: res.reply.transcription || "…" }, { role: "assistant", text: res.reply.texte, draft: res.reply.brouillon });
    await speak(res.reply);
  }

  async function speak(reply: AssistantReply) {
    setReplayUrl(null);
    if (reply.langue === "fr") {
      speakFrench(reply.texte);
      setPhase("idle");
      return;
    }
    setPhase("speaking");
    const voice = await wolofVoice(reply.texte);
    if (!mounted.current) return;
    if (!voice) {
      setPhase("idle");
      setNotice("Voix wolof indisponible pour le moment : la réponse est écrite ci-dessus.");
      return;
    }
    const url = URL.createObjectURL(voice);
    const audio = new Audio(url);
    player.current = audio;
    audio.onended = () => setPhase("idle");
    audio.onerror = () => setPhase("idle");
    try {
      await audio.play();
    } catch {
      // Lecture bloquée (iPhone) : bouton pour écouter
      setReplayUrl(url);
      setPhase("idle");
    }
  }

  const release = () => {
    if (!pressed.current) return;
    pressed.current = false;
    void stop();
  };

  return (
    <div className="flex max-h-[70dvh] flex-col gap-4 px-4 pb-6">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {turns.map((t) => (
          <div key={t.id} className={cn("max-w-[85%]", t.role === "user" ? "ml-auto text-right" : "")}>
            <p className={cn("inline-block rounded-2xl px-3 py-2 text-sm", t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {t.text}
            </p>
            {t.draft && <DraftCard draft={t.draft} />}
          </div>
        ))}
        {replayUrl && (
          <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-primary" onClick={() => void new Audio(replayUrl).play()}>
            <Play className="size-4" /> Écouter la réponse
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden
          className={cn(
            "size-20 rounded-full bg-gradient-to-br from-emerald-300 via-teal-400 to-teal-700 shadow-[0_0_40px_rgba(20,184,166,0.45)] transition-transform duration-300",
            phase === "recording" && "scale-110 animate-pulse",
            phase === "thinking" && "animate-spin [animation-duration:2.5s]",
            phase === "speaking" && "animate-pulse",
          )}
        />
        <p className="text-center text-sm text-muted-foreground">{STATUS[phase]}</p>
        {notice && <p className="text-center text-sm text-destructive">{notice}</p>}
        <button
          type="button"
          aria-label="Appuyer pour parler"
          disabled={phase === "thinking" || phase === "speaking"}
          onPointerDown={(e) => {
            e.preventDefault();
            pressed.current = true;
            void start();
          }}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "flex size-16 touch-none items-center justify-center rounded-full text-white shadow-lg transition select-none active:scale-95 disabled:opacity-50",
            phase === "recording" ? "scale-110 bg-red-600" : "bg-primary",
          )}
        >
          <Mic className="size-7" />
        </button>
      </div>
    </div>
  );
}

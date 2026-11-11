"use client";

import { Play } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { STATUTS, useAssistant } from "./assistant-provider";
import { BoutonMicro } from "./bouton-micro";

export function AssistantPanel() {
  const a = useAssistant();
  const list = useRef<HTMLDivElement | null>(null);

  // La liste défile jusqu'au dernier message.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [a.turns]);

  return (
    <div className="flex max-h-[70dvh] flex-col gap-4 px-4 pb-6">
      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {a.turns.map((t) => (
          <div key={t.id} className={cn("max-w-[85%]", t.role === "user" ? "ml-auto text-right" : "")}>
            <p className={cn("inline-block rounded-2xl px-3 py-2 text-sm", t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {t.text}
            </p>
          </div>
        ))}
        {a.rejouer && (
          <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-primary" onClick={a.rejouer}>
            <Play className="size-4" /> Écouter la réponse
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden
          className={cn(
            "size-20 rounded-full bg-gradient-to-br from-emerald-300 via-teal-400 to-teal-700 shadow-[0_0_40px_rgba(20,184,166,0.45)] transition-transform duration-300",
            a.phase === "recording" && "scale-110 animate-pulse",
            a.phase === "thinking" && "animate-spin [animation-duration:2.5s]",
            a.phase === "speaking" && "animate-pulse",
          )}
        />
        <p className="text-center text-sm text-muted-foreground">{STATUTS[a.phase]}</p>
        {a.notice && <p className="text-center text-sm text-destructive">{a.notice}</p>}
        <BoutonMicro grand />
      </div>
    </div>
  );
}

// src/components/assistant/bouton-micro.tsx
"use client";

import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistant } from "./assistant-provider";

/** Appuyer pour parler (panneau et bulle). */
export function BoutonMicro({ grand = false }: { grand?: boolean }) {
  const a = useAssistant();
  return (
    <button
      type="button"
      aria-label="Appuyer pour parler"
      disabled={a.phase === "thinking" || a.phase === "pilote"}
      onPointerDown={(e) => {
        e.preventDefault();
        a.appuyer();
      }}
      onPointerUp={a.relacher}
      onPointerLeave={a.relacher}
      onPointerCancel={a.relacher}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "flex shrink-0 touch-none items-center justify-center rounded-full text-white shadow-lg transition select-none active:scale-95 disabled:opacity-50",
        grand ? "size-16" : "size-11",
        a.phase === "recording" ? "scale-110 bg-red-600" : "bg-primary",
      )}
    >
      <Mic className={grand ? "size-7" : "size-5"} />
    </button>
  );
}

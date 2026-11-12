// src/components/assistant/pilote/plein-ecran.tsx
"use client";

import { Minimize2, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUTS, useAssistant } from "../assistant-provider";
import { Orbe } from "./orbe";

/**
 * La conversation en plein écran : le grand rond lumineux au centre, ce que fait l'assistant en une ligne, et
 * « Terminer ». Dès que l'assistant travaille sur l'écran, tout se replie vers la bulle du bas (le rond descend et
 * rapetisse) pour que le commerçant voie la tâche ; toucher le rond de la bulle revient ici.
 */
export function PleinEcranAssistant() {
  const a = useAssistant();
  if (!a.actif) return null;
  const visible = a.affichage === "plein";
  return (
    <div
      data-assistant-bulle=""
      role="dialog"
      aria-modal={visible}
      aria-label="Conversation avec l'assistant"
      aria-hidden={!visible}
      inert={!visible}
      // Une fenêtre ouverte en dessous bloque les touches du reste de la page : pas celles-ci
      style={{ pointerEvents: visible ? "auto" : "none" }}
      className={cn(
        "fixed inset-0 z-[65] flex flex-col items-center overflow-hidden text-white transition-[opacity,visibility] duration-500 print:hidden",
        visible ? "visible opacity-100" : "invisible opacity-0",
      )}
    >
      <div aria-hidden className="absolute inset-0 bg-[#03201c]/88 backdrop-blur-xl" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(20,184,166,0.3),transparent_62%)]" />

      <div className="relative flex w-full items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-8">
        <p className="text-sm font-medium tracking-wide text-white/65">Assistant Sama Stock</p>
        <button
          type="button"
          onClick={a.reduire}
          aria-label="Réduire l'assistant"
          title="Réduire"
          className="grid size-11 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
        >
          <Minimize2 className="size-5" />
        </button>
      </div>

      <div
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-12 transition-[translate,scale] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          visible ? "translate-y-0 scale-100" : "translate-y-[38vh] scale-[0.18]",
        )}
      >
        <button
          type="button"
          onClick={a.couperParole}
          aria-label={a.phase === "parle" ? "Couper la parole de l'assistant" : "Assistant"}
          className="rounded-full focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          <Orbe phase={a.phase} niveau={a.niveau} taille="grand" />
        </button>
        <p aria-live="polite" className="min-h-7 px-6 text-center text-lg font-medium text-white/90 sm:text-xl">
          {a.statut ?? STATUTS[a.phase]}
        </p>
      </div>

      <div className="relative flex flex-col items-center gap-2.5 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <button
          type="button"
          onClick={a.terminer}
          aria-label="Terminer la conversation"
          aria-keyshortcuts="Escape"
          title="Terminer (Échap ou Ctrl + Espace)"
          className="grid size-16 place-items-center rounded-full bg-red-500 text-white shadow-lg shadow-red-950/40 transition hover:bg-red-600 focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none active:scale-95"
        >
          <PhoneOff className="size-7" />
        </button>
        <span className="text-sm text-white/65">
          Terminer
          <kbd className="ml-1.5 hidden rounded border border-white/25 px-1 font-sans text-[0.625rem] lg:inline">Échap</kbd>
        </span>
      </div>
    </div>
  );
}

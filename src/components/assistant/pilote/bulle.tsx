// src/components/assistant/pilote/bulle.tsx
"use client";

import { Check, PhoneOff, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUTS, useAssistant } from "../assistant-provider";
import { Doigt } from "./doigt";

/**
 * Bulle de la conversation : un rond qui vit avec la voix (écoute, parle, regarde, remplit), « Terminer », et pendant
 * l'accord le résumé de la tâche avec Oui / Non. Aucun fil de discussion écrit : on parle avec l'assistant.
 */
export function BulleAssistant() {
  const a = useAssistant();
  if (!a.actif && a.statut === null && a.notice === null) return null;
  const accord = a.phase === "confirmation";
  return (
    <div
      data-assistant-bulle=""
      role="status"
      aria-live="polite"
      style={{ pointerEvents: "auto" }}
      // En haut sur téléphone : en bas, elle cacherait la barre du panier et la barre de navigation
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] mx-auto max-w-md rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur lg:top-auto lg:bottom-6 print:hidden"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={a.phase === "parle" ? "Couper la parole de l'assistant" : "Assistant"}
          onClick={a.couperParole}
          className="relative grid size-12 shrink-0 place-items-center"
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full bg-gradient-to-br from-emerald-300 via-teal-400 to-teal-700 transition-transform duration-300",
              a.phase === "ecoute" && "scale-110 animate-pulse",
              a.phase === "parle" && "scale-105 animate-[pulse_0.9s_ease-in-out_infinite]",
              (a.phase === "outil" || a.phase === "connexion") && "animate-spin [animation-duration:2.5s]",
              a.phase === "pilote" && "animate-pulse",
              !a.actif && "opacity-50",
            )}
          />
          {a.phase === "ecoute" && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-teal-400/40" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{accord ? STATUTS.confirmation : (a.statut ?? STATUTS[a.phase])}</p>
          {accord && a.resume && <p className="mt-0.5 text-sm text-muted-foreground">{a.resume}</p>}
          {a.notice && <p className="mt-1 text-sm text-destructive">{a.notice}</p>}
        </div>
        {a.actif ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={a.terminer}
            aria-label="Terminer la conversation"
            aria-keyshortcuts="Escape"
            title="Terminer (Échap ou Ctrl + Espace)"
          >
            <PhoneOff /> Terminer
            <kbd className="ml-1 hidden rounded border px-1 font-sans text-[0.625rem] text-muted-foreground lg:inline">Échap</kbd>
          </Button>
        ) : (
          <button type="button" aria-label="Fermer" onClick={a.fermerStatut} className="rounded-full p-1 text-muted-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>
      {accord && (
        <div className="mt-3 flex items-center gap-2">
          <Button className="flex-1" onClick={() => a.accord(true)}>
            <Check /> Oui
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => a.accord(false)}>
            Non
          </Button>
        </div>
      )}
      {a.phase === "pilote" && (
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={a.arreterTache}>
          <Square /> Arrêter la tâche
        </Button>
      )}
    </div>
  );
}

export function DoigtAssistant() {
  const a = useAssistant();
  return <Doigt position={a.doigt} touche={a.touche} />;
}

// src/components/assistant/pilote/bulle.tsx
"use client";

import { Check, MessageCircle, PhoneOff, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUTS, useAssistant } from "../assistant-provider";
import { Doigt } from "./doigt";
import { Orbe } from "./orbe";

/**
 * Bulle de la conversation : un rond qui vit avec la voix (écoute, parle, regarde, remplit), « Terminer », et pendant
 * l'accord le résumé de la tâche avec Oui / Non, et le bouton vert d'envoi WhatsApp quand le téléphone exige un toucher.
 * Aucun fil de discussion écrit : on parle avec l'assistant.
 */
export function BulleAssistant() {
  const a = useAssistant();
  if (a.affichage !== "bulle") return null;
  const accord = a.phase === "confirmation";
  const tache = a.phase === "pilote" || accord;
  return (
    <div
      data-assistant-bulle=""
      role="status"
      aria-live="polite"
      style={{ pointerEvents: "auto" }}
      // En haut sur téléphone : en bas, elle cacherait la barre du panier et la barre de navigation
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] mx-auto max-w-md rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur motion-safe:animate-[enter-pop_0.45s_cubic-bezier(0.16,1,0.3,1)] lg:top-auto lg:bottom-6 print:hidden"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          // Pendant une tâche, le rond coupe la parole ; sinon il ramène la conversation en plein écran
          aria-label={tache ? "Couper la parole de l'assistant" : "Agrandir l'assistant"}
          title={tache ? undefined : "Agrandir"}
          disabled={!a.actif}
          onClick={tache ? a.couperParole : a.agrandir}
          className="relative grid size-12 shrink-0 place-items-center rounded-full"
        >
          <Orbe phase={a.phase} niveau={a.niveau} taille="petit" className={cn(!a.actif && "opacity-50")} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{accord ? a.question : (a.statut ?? STATUTS[a.phase])}</p>
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
      {a.geste && (
        <Button size="lg" className="mt-3 w-full bg-[#25D366] text-[#0b1310] hover:bg-[#1fb857]" onClick={a.faireGeste}>
          <MessageCircle /> {a.geste}
        </Button>
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

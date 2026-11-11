// src/components/assistant/pilote/bulle.tsx
"use client";

import { Check, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUTS, useAssistant } from "../assistant-provider";
import { BoutonMicro } from "../bouton-micro";
import { Doigt } from "./doigt";

/** Barre flottante pendant une mission : ce que fait l'assistant, Arrêter, puis Oui / Non et le micro. */
export function BulleAssistant() {
  const a = useAssistant();
  if (a.ouvert || (a.phase === "idle" && a.statut === null)) return null;
  const accord = a.phase === "confirmation";
  return (
    <div
      data-assistant-bulle=""
      role="status"
      aria-live="polite"
      style={{ pointerEvents: "auto" }}
      className="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-md rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur lg:bottom-6 print:hidden"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className={cn(
            "mt-0.5 size-8 shrink-0 rounded-full bg-gradient-to-br from-emerald-300 via-teal-400 to-teal-700",
            (a.phase === "pilote" || a.phase === "thinking") && "animate-pulse",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{accord ? STATUTS.confirmation : (a.statut ?? STATUTS[a.phase])}</p>
          {accord && a.resume && <p className="mt-0.5 text-sm text-muted-foreground">{a.resume}</p>}
          {a.notice && <p className="mt-1 text-sm text-destructive">{a.notice}</p>}
        </div>
        {a.phase === "idle" && (
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
          <BoutonMicro />
        </div>
      )}
      {a.phase === "pilote" && (
        <Button variant="outline" className="mt-3 w-full" onClick={a.arreter}>
          <Square /> Arrêter
        </Button>
      )}
    </div>
  );
}

export function DoigtAssistant() {
  const a = useAssistant();
  return <Doigt position={a.doigt} touche={a.touche} />;
}

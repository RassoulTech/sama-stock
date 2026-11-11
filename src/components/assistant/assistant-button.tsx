"use client";

import { Mic } from "lucide-react";
import { useOfflineMode } from "@/components/offline/offline-provider";
import { useAssistant } from "./assistant-provider";

/** Micro flottant : un toucher ouvre la conversation à la voix ; pendant la conversation, la bulle le remplace. */
export function AssistantButton() {
  const { online } = useOfflineMode();
  const a = useAssistant();
  if (a.actif) return null;
  const label = online ? "Parler avec l'assistant" : "Assistant indisponible hors connexion";

  return (
    <button
      type="button"
      onClick={a.demarrer}
      disabled={!online}
      aria-label={label}
      title={label}
      className="fixed right-4 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95 disabled:bg-muted disabled:text-muted-foreground lg:bottom-6 print:hidden"
    >
      <Mic className="size-6" />
    </button>
  );
}

"use client";

import { Mic } from "lucide-react";
import { useEffect, useRef } from "react";
import { useOfflineMode } from "@/components/offline/offline-provider";
import { useAssistant } from "./assistant-provider";
import { estFermetureAssistant, estRaccourciAssistant, LIBELLE_RACCOURCI } from "./raccourci";

/**
 * Micro flottant : un toucher (ou Ctrl + Espace sur ordinateur) ouvre la conversation à la voix ; pendant la
 * conversation, la bulle le remplace, et Ctrl + Espace ou Échap la ferme.
 */
export function AssistantButton() {
  const { online } = useOfflineMode();
  const a = useAssistant();
  const courant = useRef({ a, online });
  useEffect(() => {
    courant.current = { a, online };
  });

  useEffect(() => {
    const surTouche = (event: KeyboardEvent) => {
      const { a: assistant, online: enLigne } = courant.current;
      if (estRaccourciAssistant(event)) {
        event.preventDefault();
        // Le son est débloqué ici, dans l'appui sur la touche, comme dans un toucher du micro
        if (assistant.actif) assistant.terminer();
        else if (enLigne) assistant.demarrer();
      } else if (assistant.actif && estFermetureAssistant(event) && !event.defaultPrevented) {
        // Une fenêtre ouverte prend Échap pour elle (elle marque l'évènement) : la conversation continue
        assistant.terminer();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  if (a.actif) return null;
  const label = online ? `Parler avec l'assistant (${LIBELLE_RACCOURCI})` : "Assistant indisponible hors connexion";

  return (
    <button
      type="button"
      onClick={a.demarrer}
      disabled={!online}
      aria-label={label}
      aria-keyshortcuts="Control+Space"
      title={label}
      className="fixed right-4 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95 disabled:bg-muted disabled:text-muted-foreground lg:bottom-6 print:hidden"
    >
      <Mic className="size-6" />
    </button>
  );
}

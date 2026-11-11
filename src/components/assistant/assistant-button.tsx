"use client";

import { Mic } from "lucide-react";
import { useOfflineMode } from "@/components/offline/offline-provider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AssistantPanel } from "./assistant-panel";
import { useAssistant } from "./assistant-provider";

/** Bouton micro flottant ; la conversation est gardée par AssistantProvider. Pendant une mission, la bulle le remplace. */
export function AssistantButton() {
  const { online } = useOfflineMode();
  const a = useAssistant();
  const label = online ? "Assistant vocal" : "Assistant indisponible hors connexion";
  const enMission = a.phase === "pilote" || a.phase === "confirmation";

  return (
    <>
      {!enMission && (
        <button
          type="button"
          onClick={() => a.setOuvert(true)}
          disabled={!online}
          aria-label={label}
          title={label}
          className="fixed right-4 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95 disabled:bg-muted disabled:text-muted-foreground lg:bottom-6 print:hidden"
        >
          <Mic className="size-6" />
        </button>
      )}
      <Sheet open={a.ouvert} onOpenChange={a.setOuvert}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Assistant vocal</SheetTitle>
          </SheetHeader>
          {a.ouvert && <AssistantPanel />}
        </SheetContent>
      </Sheet>
    </>
  );
}

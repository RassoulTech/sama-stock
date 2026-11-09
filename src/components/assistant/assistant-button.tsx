"use client";

import { Mic } from "lucide-react";
import { useState } from "react";
import { useOfflineMode } from "@/components/offline/offline-provider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AssistantPanel } from "./assistant-panel";

/** Bouton micro flottant. Fermer le panneau efface la conversation (rien n'est gardé). */
export function AssistantButton() {
  const { online } = useOfflineMode();
  const [open, setOpen] = useState(false);
  const label = online ? "Assistant vocal" : "Assistant indisponible hors connexion";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!online}
        aria-label={label}
        title={label}
        className="fixed right-4 bottom-24 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95 disabled:bg-muted disabled:text-muted-foreground lg:bottom-6 print:hidden"
      >
        <Mic className="size-6" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Assistant vocal</SheetTitle>
          </SheetHeader>
          {open && <AssistantPanel />}
        </SheetContent>
      </Sheet>
    </>
  );
}

"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAssistant } from "./assistant-provider";

/** Finch n'est pas payé ou n'a plus de crédits : ce qu'il faut faire, et le bouton WhatsApp vers Sama Stock. */
export function FicheAbonnementAssistant() {
  const a = useAssistant();
  const fiche = a.fiche;
  return (
    <Dialog
      open={fiche !== null}
      onOpenChange={(open) => {
        if (!open) a.fermerFiche();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fiche?.titre}</DialogTitle>
          <DialogDescription>{fiche?.texte}</DialogDescription>
        </DialogHeader>
        {fiche?.lien && fiche.bouton && (
          <DialogFooter>
            <Button asChild>
              <a href={fiche.lien} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> {fiche.bouton}
              </a>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

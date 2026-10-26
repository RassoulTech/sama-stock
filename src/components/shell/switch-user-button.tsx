"use client";

import { Loader2, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOutSafely } from "@/lib/offline/sign-out";

/** Appareil de la boutique : ferme la session en cours et revient au choix du nom et au code PIN. */
export function SwitchUserButton({ href }: { href: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        if (!(await signOutSafely())) {
          setPending(false);
          return;
        }
        window.location.replace(href);
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Users />}
      <span className="hidden sm:inline">Changer d&apos;employé</span>
      <span className="sr-only sm:hidden">Changer d&apos;employé</span>
    </Button>
  );
}

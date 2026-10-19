"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GoogleIcon } from "@/components/brand/google-icon";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleButton({ callbackURL, newUserCallbackURL }: { callbackURL: string; newUserCallbackURL: string }) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL, newUserCallbackURL });
    if (error) {
      setPending(false);
      toast.error("La connexion avec Google a échoué. Réessayez.");
    }
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={onClick} disabled={pending}>
      <GoogleIcon className="size-5" />
      Continuer avec Google
    </Button>
  );
}

export function OrSeparator() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      ou
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

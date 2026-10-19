"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEMO_ACCOUNT } from "@/components/auth/sign-in-form";
import { LogoMark } from "@/components/brand/logo";
import { authClient } from "@/lib/auth-client";

/** Ouvre le commerce de démonstration sans rien saisir. */
export function DemoLogin() {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void authClient.signIn.email(DEMO_ACCOUNT).then(({ error }) => {
      if (error) {
        setFailed(true);
        return;
      }
      router.replace("/tableau-de-bord");
      router.refresh();
    });
  }, [router]);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <LogoMark className="size-12" />
        {failed ? (
          <>
            <p className="font-medium">La démonstration n&apos;est pas disponible pour le moment.</p>
            <Link href="/inscription" className="text-sm font-medium text-primary hover:underline">
              Créer mon compte gratuit
            </Link>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Ouverture du commerce de démonstration…
          </p>
        )}
      </div>
    </div>
  );
}

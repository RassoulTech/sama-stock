"use client";

import { CheckCircle2, CloudOff, Loader2, LogIn, TriangleAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOfflineMode } from "./offline-provider";

function ventes(n: number) {
  return `${n} vente${n > 1 ? "s" : ""}`;
}

/** Un seul message à la fois : session expirée, pas d'internet, ventes refusées, envoi en cours, envoi réussi. */
export function OfflineBanner({ inOfflineApp = false, onShowPending }: { inOfflineApp?: boolean; onShowPending?: () => void }) {
  const o = useOfflineMode();
  const pathname = usePathname();
  const { pending, refused } = o.summary;
  const link = "font-semibold underline underline-offset-4";

  let tone: "saffron" | "red" | "blue" | "green";
  let icon: React.ReactNode;
  let content: React.ReactNode;

  if (o.sessionExpired && pending + refused > 0) {
    tone = "saffron";
    icon = <LogIn className="size-4" />;
    content = (
      <>
        Reconnectez-vous pour envoyer {ventes(pending + refused)}.{" "}
        <a href="/connexion?redirect=/vendre" className={link}>
          Se connecter
        </a>
      </>
    );
  } else if (!o.online) {
    tone = "saffron";
    icon = <CloudOff className="size-4" />;
    content = (
      <>
        Pas d&apos;internet : vous pouvez continuer à vendre.
        {pending > 0 && <> {ventes(pending)} en attente d&apos;envoi.</>}
        {!inOfflineApp && pathname !== "/vendre" && (
          <>
            {" "}
            <a href="/hors-ligne" className={link}>
              Ouvrir la caisse
            </a>
          </>
        )}
      </>
    );
  } else if (refused > 0) {
    tone = "red";
    icon = <TriangleAlert className="size-4" />;
    content = (
      <>
        {ventes(refused)} n&apos;{refused > 1 ? "ont" : "a"} pas pu être envoyée{refused > 1 ? "s" : ""}.{" "}
        {inOfflineApp ? (
          <button type="button" onClick={onShowPending} className={link}>
            Voir
          </button>
        ) : (
          <a href="/hors-ligne?onglet=attente" className={link}>
            Voir
          </a>
        )}
      </>
    );
  } else if (pending > 0) {
    tone = "blue";
    icon = <Loader2 className="size-4 animate-spin" />;
    content = (
      <>
        Envoi de {ventes(pending)} faite{pending > 1 ? "s" : ""} sans internet…
      </>
    );
  } else if (o.justSent > 0) {
    tone = "green";
    icon = <CheckCircle2 className="size-4" />;
    content = (
      <>
        {ventes(o.justSent)} envoyée{o.justSent > 1 ? "s" : ""}.
      </>
    );
  } else {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-center text-[0.8125rem]",
        tone === "saffron" && "bg-saffron/15 text-warning dark:text-saffron",
        tone === "red" && "bg-destructive/10 text-destructive",
        tone === "blue" && "bg-accent text-accent-foreground",
        tone === "green" && "bg-success/10 text-success",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span>{content}</span>
    </div>
  );
}

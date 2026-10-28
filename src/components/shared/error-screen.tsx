"use client";

import { Home, MessageCircle, RotateCcw, TriangleAlert, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Logo } from "@/components/brand/logo";
import { describeError, errorDigest, shortCode } from "@/lib/domain/app-errors";
import { salesLink } from "@/lib/whatsapp";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** « Un problème est survenu » : réessayer, revenir à l'accueil, ou nous écrire avec le code de la panne. */
export function ErrorScreen({
  error,
  retry,
  homeHref = "/",
  fullPage = false,
}: {
  error: unknown;
  retry: () => void;
  homeHref?: string;
  fullPage?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const offline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine, () => false);
  const digest = errorDigest(error);
  const code = shortCode(digest);

  useEffect(() => {
    // Panne du serveur (digest) : déjà enregistrée par le serveur. Hors ligne : ce n'est pas une panne.
    if (digest || !navigator.onLine) return;
    void fetch("/api/erreurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: describeError(error).slice(0, 500), path: window.location.pathname.slice(0, 300) }),
      keepalive: true,
    }).catch(() => {});
  }, [error, digest]);

  const help = salesLink(`Bonjour Sama Stock, j'ai un problème sur l'application${code ? ` (code ${code})` : ""}, page ${pathname}.`);

  const content = (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent text-primary">
        {offline ? <WifiOff className="size-8" /> : <TriangleAlert className="size-8" />}
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">{offline ? "Pas d'internet" : "Un problème est survenu"}</h1>
      <p className="mt-3 text-muted-foreground">
        {offline
          ? "Vérifiez la connexion du téléphone, puis réessayez."
          : "Ce n'est pas de votre faute : l'équipe Sama Stock est prévenue. Réessayez dans un instant."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <RotateCcw className="size-4" /> Réessayer
        </button>
        <Link href={homeHref} className="inline-flex h-11 items-center gap-2 rounded-lg border px-5 text-sm font-medium hover:bg-muted">
          <Home className="size-4" /> {"Retour à l'accueil"}
        </Link>
        {!offline && (
          <a
            href={help}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-lg border px-5 text-sm font-medium hover:bg-muted"
          >
            <MessageCircle className="size-4" /> Nous écrire sur WhatsApp
          </a>
        )}
      </div>
      {code && (
        <p className="mt-6 text-xs text-muted-foreground">
          Code : <span className="font-mono font-medium text-foreground">{code}</span>
        </p>
      )}
    </div>
  );

  if (!fullPage) return content;
  return (
    <div className="flex min-h-dvh flex-col bg-white dark:bg-background">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
        <Link href="/" aria-label="Sama Stock, accueil">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center">{content}</main>
    </div>
  );
}

"use client";

import "./globals.css";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/shared/error-screen";

/** Panne dans la mise en page principale : page de secours complète (ses propres <html> et <body>). */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Même thème que l'application (next-themes garde le choix sous « theme »)
    try {
      const theme = localStorage.getItem("theme");
      const dark = theme === "dark" || ((!theme || theme === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      // Stockage indisponible : thème clair
    }
  }, []);
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <title>Un problème est survenu · Sama Stock</title>
        <ErrorScreen error={error} retry={retry} fullPage />
      </body>
    </html>
  );
}

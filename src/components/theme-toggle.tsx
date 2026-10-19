"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** Bascule clair / sombre. Les deux icônes sont rendues côté serveur et le CSS choisit : pas de saut au chargement. */
export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Changer de thème (clair ou sombre)"
      className={cn(
        "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        withLabel ? "px-3 text-sm font-medium" : "w-9",
        className,
      )}
    >
      <Sun className="size-[1.125rem] dark:hidden" />
      <Moon className="hidden size-[1.125rem] dark:block" />
      {withLabel && (
        <>
          <span className="dark:hidden">Passer en mode sombre</span>
          <span className="hidden dark:inline">Passer en mode clair</span>
        </>
      )}
    </button>
  );
}

// src/components/assistant/pilote/orbe.tsx
"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Phase } from "../assistant-provider";

/**
 * Le rond lumineux de l'assistant : il flotte, ses reflets tournent, et il bat au rythme de la voix (la sienne quand
 * il parle, celle du commerçant quand il écoute). Le niveau du son est lu à chaque image et posé dans `--niveau`,
 * sans rendu React.
 */
export function Orbe({
  phase,
  niveau,
  taille,
  className,
}: {
  phase: Phase;
  niveau: () => number;
  taille: "grand" | "petit";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const lire = useRef(niveau);
  useEffect(() => {
    lire.current = niveau;
  });

  useEffect(() => {
    let lisse = 0;
    let image = 0;
    const battre = () => {
      const cible = lire.current();
      // Monte vite avec la voix, redescend en douceur
      lisse += (cible - lisse) * (cible > lisse ? 0.45 : 0.1);
      ref.current?.style.setProperty("--niveau", lisse.toFixed(3));
      image = requestAnimationFrame(battre);
    };
    image = requestAnimationFrame(battre);
    return () => cancelAnimationFrame(image);
  }, []);

  const grand = taille === "grand";
  const parle = phase === "parle";
  const cherche = phase === "connexion" || phase === "outil";
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn("relative block", grand ? "orbe-flotte size-56 sm:size-72" : "size-12", className)}
      style={{ "--niveau": 0 } as React.CSSProperties}
    >
      {/* Halo : il s'élargit et s'éclaire avec la voix */}
      <span
        className={cn(
          "absolute rounded-full blur-2xl transition-colors duration-700",
          grand ? "-inset-[30%]" : "-inset-[35%] blur-md",
          parle
            ? "bg-[radial-gradient(circle,rgba(34,211,238,0.6),rgba(20,184,166,0.18)_45%,transparent_70%)]"
            : "bg-[radial-gradient(circle,rgba(52,211,153,0.55),rgba(20,184,166,0.15)_45%,transparent_70%)]",
        )}
        style={{ opacity: "calc(0.4 + var(--niveau) * 0.6)", scale: "calc(0.85 + var(--niveau) * 0.4)" }}
      />
      <span className={cn("absolute inset-0 rounded-full", phase === "ecoute" && "orbe-respire")}>
        {/* La sphère : elle gonfle avec la voix */}
        <span
          className={cn(
            "absolute inset-0 overflow-hidden rounded-full transition-[background] duration-700",
            grand
              ? "shadow-[0_0_80px_rgba(45,212,191,0.45),inset_-18px_-26px_60px_rgba(4,47,46,0.6),inset_14px_18px_40px_rgba(255,255,255,0.28)]"
              : "shadow-[0_0_18px_rgba(45,212,191,0.5),inset_-4px_-6px_12px_rgba(4,47,46,0.55),inset_3px_4px_8px_rgba(255,255,255,0.3)]",
            parle
              ? "bg-[radial-gradient(circle_at_32%_26%,#f0fdfa_0%,#67e8f9_16%,#22d3ee_38%,#0e7490_72%,#164e63_100%)]"
              : "bg-[radial-gradient(circle_at_32%_26%,#ecfdf5_0%,#6ee7b7_16%,#14b8a6_40%,#0f766e_72%,#134e4a_100%)]",
            cherche && "saturate-[0.85]",
          )}
          style={{ scale: "calc(1 + var(--niveau) * 0.16)" }}
        >
          {/* Reflets qui tournent (plus vite quand il cherche) */}
          <span
            className={cn(
              // Flous : des volutes de lumière, sans lignes qui se rejoignent au centre
              "orbe-reflets absolute -inset-1/4 mix-blend-screen",
              grand ? "blur-2xl" : "blur-sm",
              cherche && "orbe-reflets-vite",
              "bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.4)_50deg,transparent_110deg,rgba(167,243,208,0.35)_190deg,transparent_250deg,rgba(103,232,249,0.3)_310deg,transparent_360deg)]",
            )}
          />
          {/* Point de lumière */}
          <span className="absolute top-[11%] left-[20%] h-[28%] w-[36%] rounded-full bg-white/45 blur-md" />
        </span>
      </span>
    </span>
  );
}

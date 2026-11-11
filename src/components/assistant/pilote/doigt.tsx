// src/components/assistant/pilote/doigt.tsx
"use client";

import { Pointer } from "lucide-react";
import type { PositionDoigt } from "./scene-dom";

/** Doigt et anneau au-dessus de la page ; ils ne captent jamais les touches. */
export function Doigt({ position, touche }: { position: PositionDoigt | null; touche: number }) {
  if (!position) return null;
  const { x, y, largeur, hauteur } = position;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] print:hidden">
      <div
        className="absolute rounded-xl ring-4 ring-primary/70 transition-all duration-300 ease-out"
        style={{ left: x - largeur / 2 - 6, top: y - hauteur / 2 - 6, width: largeur + 12, height: hauteur + 12 }}
      />
      <div className="absolute transition-all duration-[400ms] ease-out" style={{ left: x - 6, top: y - 2 }}>
        <span key={touche} className="absolute -top-3 -left-3 size-8 animate-ping rounded-full bg-primary/40 [animation-iteration-count:1]" />
        <Pointer className="size-9 fill-white text-primary drop-shadow-lg" />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format";

const DURATION_MS = 900;

/** Chiffre qui défile jusqu'à sa valeur à l'affichage (immédiat si l'appareil limite les animations). */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = reduce ? 1 : Math.min(1, (now - start) / DURATION_MS);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{formatNumber(shown)}</>;
}

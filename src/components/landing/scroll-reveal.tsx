"use client";

import { useEffect } from "react";

/**
 * Fait apparaître les éléments `.reveal` quand ils entrent à l'écran (tous navigateurs).
 * Les éléments d'une même grille arrivent les uns après les autres.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));

    for (const el of elements) {
      const siblings = Array.from(el.parentElement?.children ?? []).filter((c) => c.classList.contains("reveal"));
      const index = Math.min(siblings.indexOf(el), 4);
      if (index > 0) el.style.setProperty("--reveal-delay", `${index * 90}ms`);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    // Ce qui est déjà visible au chargement s'affiche sans attendre
    for (const el of elements) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) el.classList.add("is-visible");
      else observer.observe(el);
    }
    document.documentElement.classList.add("reveal-on");

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("reveal-on");
    };
  }, []);

  return null;
}

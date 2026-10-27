"use client";

import { useSyncExternalStore } from "react";

/** « Bonjour » de 5 h à 17 h 59, « Bonsoir » ensuite (heure locale). */
export function greetingFor(hour: number): "Bonjour" | "Bonsoir" {
  return hour >= 5 && hour < 18 ? "Bonjour" : "Bonsoir";
}

// L'heure change pendant que la page reste ouverte : on revérifie chaque minute
const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
};

/**
 * Bonjour ou Bonsoir selon l'heure du téléphone (ou de l'ordinateur). Le serveur, lui, prend l'heure de Dakar :
 * c'est la même au Sénégal, et le texte se corrige tout seul ailleurs.
 */
export function Greeting() {
  return useSyncExternalStore(
    subscribe,
    () => greetingFor(new Date().getHours()),
    () => greetingFor(new Date().getUTCHours()),
  );
}

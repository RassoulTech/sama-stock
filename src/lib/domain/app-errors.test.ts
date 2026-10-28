import { describe, expect, it } from "vitest";
import {
  alertText,
  describeError,
  errorDigest,
  errorKey,
  isFrameworkSignal,
  normalizeErrorMessage,
  normalizeRoute,
  shortCode,
  shouldAlert,
} from "./app-errors";

const ID = "4db17195-b4e0-44cb-ac80-451a025d0c3f";

describe("reconnaître une même panne", () => {
  it("ignore les nombres et les identifiants du message", () => {
    expect(normalizeErrorMessage(`Vente ${ID} introuvable (12 lignes)`)).toBe("Vente :id introuvable (# lignes)");
  });
  it("ignore les paramètres et identifiants de l'adresse", () => {
    expect(normalizeRoute(`/ventes/${ID}?onglet=2`)).toBe("/ventes/:id");
    expect(normalizeRoute("")).toBe("/");
  });
  it("donne la même clé pour la même panne, une autre pour une autre page ou une autre source", () => {
    const a = errorKey("serveur", `/ventes/${ID}`, "Timeout après 30 s");
    expect(errorKey("serveur", `/ventes/${ID.replace("4", "5")}`, "Timeout après 45 s")).toBe(a);
    expect(errorKey("serveur", "/stock", "Timeout après 30 s")).not.toBe(a);
    expect(errorKey("navigateur", `/ventes/${ID}`, "Timeout après 30 s")).not.toBe(a);
  });
});

describe("quand prévenir", () => {
  const now = new Date("2026-10-29T10:00:00Z");
  it("prévient pour une panne nouvelle", () => {
    expect(shouldAlert(null, now)).toBe(true);
  });
  it("ne prévient pas deux fois de suite", () => {
    expect(shouldAlert({ lastSeenAt: new Date("2026-10-29T09:00:00Z"), resolvedAt: null }, now)).toBe(false);
  });
  it("prévient si la panne revient après « Réglée »", () => {
    expect(shouldAlert({ lastSeenAt: new Date("2026-10-29T09:59:00Z"), resolvedAt: new Date("2026-10-29T09:30:00Z") }, now)).toBe(true);
  });
  it("prévient si la panne revient après 24 h de calme", () => {
    expect(shouldAlert({ lastSeenAt: new Date("2026-10-28T09:59:00Z"), resolvedAt: null }, now)).toBe(true);
  });
});

describe("erreurs à ignorer et à décrire", () => {
  it("reconnaît les signaux normaux de Next.js", () => {
    expect(isFrameworkSignal("NEXT_REDIRECT;replace;/connexion;307;")).toBe(true);
    expect(isFrameworkSignal("NEXT_HTTP_ERROR_FALLBACK;404")).toBe(true);
    expect(isFrameworkSignal("1234567890")).toBe(false);
    expect(isFrameworkSignal(undefined)).toBe(false);
  });
  it("lit le digest et décrit l'erreur", () => {
    expect(errorDigest(Object.assign(new Error("x"), { digest: "abc123" }))).toBe("abc123");
    expect(errorDigest(new Error("x"))).toBeUndefined();
    expect(errorDigest("texte")).toBeUndefined();
    expect(describeError(new TypeError("a is undefined"))).toBe("TypeError: a is undefined");
    expect(describeError("oups")).toBe("oups");
    expect(describeError({})).toBe("Erreur inconnue");
  });
  it("donne un code court lisible", () => {
    expect(shortCode("3086419467")).toBe("308641");
    expect(shortCode("ab-cd_ef9")).toBe("ABCDEF");
    expect(shortCode(undefined)).toBeNull();
  });
});

describe("texte de l'alerte", () => {
  it("dit où, quoi et combien de fois", () => {
    const t = alertText({ source: "serveur", route: "/vendre", message: "Connexion à la base perdue", count: 1 });
    expect(t.title).toBe("Panne sur Sama Stock — /vendre");
    expect(t.body).toBe("serveur : Connexion à la base perdue (1re fois)");
    expect(alertText({ source: "sauvegarde", route: "/", message: "x", count: 3 }).title).toBe("Panne sur Sama Stock — Sauvegarde");
    expect(alertText({ source: "navigateur", route: "/stock", message: "x", count: 3 }).body).toBe("téléphone ou ordinateur : x (3 fois)");
  });
});

/** Pannes du site : reconnaître une même panne et décider quand prévenir l'administrateur. */

export const ERROR_SOURCES = ["serveur", "navigateur", "sauvegarde"] as const;
export type ErrorSource = (typeof ERROR_SOURCES)[number];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Adresse sans paramètres ni identifiants : « /ventes/<id>?x=1 » → « /ventes/:id ». */
export function normalizeRoute(route: string): string {
  const path = route.split("?")[0] || "/";
  return path.replace(UUID, ":id").slice(0, 200);
}

/** Une même panne revient avec d'autres nombres ou identifiants : on les remplace pour la reconnaître. */
export function normalizeErrorMessage(message: string): string {
  return message.replace(UUID, ":id").replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Clé d'une panne ; le serveur en garde l'empreinte SHA-1. */
export function errorKey(source: ErrorSource, route: string, message: string): string {
  return `${source}|${normalizeRoute(route)}|${normalizeErrorMessage(message)}`;
}

export const REALERT_AFTER_HOURS = 24;

/** Prévenir si la panne est nouvelle, revenue après « Réglée », ou revenue après 24 h de calme. */
export function shouldAlert(previous: { lastSeenAt: Date; resolvedAt: Date | null } | null, now: Date): boolean {
  if (!previous) return true;
  if (previous.resolvedAt) return true;
  return now.getTime() - previous.lastSeenAt.getTime() >= REALERT_AFTER_HOURS * 3_600_000;
}

/** Redirection, page introuvable… : le fonctionnement normal de Next.js, pas une panne. */
export function isFrameworkSignal(digest: string | undefined): boolean {
  return Boolean(
    digest && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(digest),
  );
}

export function errorDigest(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) return undefined;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest ? digest : undefined;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message ? `${error.name}: ${error.message}` : error.name;
  return typeof error === "string" && error ? error : "Erreur inconnue";
}

/** Code court affiché sur la page d'erreur pour retrouver la panne. */
export function shortCode(digest: string | null | undefined): string | null {
  const clean = (digest ?? "").replace(/[^a-z0-9]/gi, "");
  return clean ? clean.slice(0, 6).toUpperCase() : null;
}

const SOURCE_LABELS: Record<ErrorSource, string> = {
  serveur: "serveur",
  navigateur: "téléphone ou ordinateur",
  sauvegarde: "sauvegarde",
};

export function alertText(input: { source: ErrorSource; route: string; message: string; count: number }): { title: string; body: string } {
  const where = input.source === "sauvegarde" ? "Sauvegarde" : input.route;
  const times = input.count <= 1 ? "1re fois" : `${input.count} fois`;
  return { title: `Panne sur Sama Stock — ${where}`, body: `${SOURCE_LABELS[input.source]} : ${input.message.slice(0, 140)} (${times})` };
}

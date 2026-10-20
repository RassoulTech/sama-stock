/**
 * Filtres partagés par les listes (ventes, commandes, stock, rapports).
 * Les filtres vivent dans l'adresse de la page : on peut recharger, partager ou revenir en arrière.
 * Toutes les dates sont calculées en heure de Dakar (UTC+0).
 */

export type SearchParams = Record<string, string | string[] | undefined>;

/** Valeur du filtre catégorie pour les produits sans catégorie. */
export const NO_CATEGORY = "aucune";

const DAY = 86_400_000;

export const PERIOD_PRESETS = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  "7j": "7 jours",
  "30j": "30 jours",
  mois: "Ce mois-ci",
  "mois-dernier": "Mois dernier",
  "90j": "90 jours",
  tout: "Tout",
} as const;

export type PeriodPreset = keyof typeof PERIOD_PRESETS;

/** Périodes proposées dans les rapports (et pour leur export). */
export const REPORT_PRESETS: PeriodPreset[] = ["7j", "30j", "mois", "mois-dernier", "90j"];

/** Valeur de `periode` quand l'utilisateur choisit ses propres dates (`du` et `au`). */
export const CUSTOM_PERIOD = "dates";

/** Plus longue période personnalisée acceptée, en jours. */
export const MAX_CUSTOM_DAYS = 366;

export interface DateRange {
  key: PeriodPreset | typeof CUSTOM_PERIOD;
  /** Début inclus (null = depuis toujours). */
  from: Date | null;
  /** Fin exclue (null = jusqu'à maintenant). */
  to: Date | null;
  /** Nombre de jours couverts (null pour « Tout »). */
  days: number | null;
  label: string;
  /** Dates saisies, au format AAAA-MM-JJ, pour la période personnalisée. */
  du?: string;
  au?: string;
}

/** Première valeur d'un paramètre d'adresse. */
export function param(params: SearchParams, name: string): string | undefined {
  const v = params[name];
  const value = Array.isArray(v) ? v[0] : v;
  return value?.trim() || undefined;
}

/** Valeur d'un paramètre si elle fait partie des valeurs permises, sinon null. */
export function pickParam<T extends string>(params: SearchParams, name: string, allowed: readonly T[]): T | null {
  const v = param(params, name);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export function dayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

/** « 2026-10-15 » → date (minuit UTC), ou null si invalide. */
export function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

export function formatDayParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

export function customPeriodLabel(from: Date, toInclusive: Date): string {
  return from.getTime() === toInclusive.getTime()
    ? `Le ${shortDay.format(from)}`
    : `Du ${shortDay.format(from)} au ${shortDay.format(toInclusive)}`;
}

export function presetRange(key: PeriodPreset, now = new Date()): DateRange {
  const today = dayStart(now);
  const tomorrow = addDays(today, 1);
  const label = PERIOD_PRESETS[key];
  const range = (from: Date | null, to: Date | null): DateRange => ({
    key,
    from,
    to,
    days: from && to ? Math.round((to.getTime() - from.getTime()) / DAY) : null,
    label,
  });
  switch (key) {
    case "today":
      return range(today, tomorrow);
    case "yesterday":
      return range(addDays(today, -1), today);
    case "7j":
      return range(addDays(today, -6), tomorrow);
    case "30j":
      return range(addDays(today, -29), tomorrow);
    case "90j":
      return range(addDays(today, -89), tomorrow);
    case "mois":
      return range(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), tomorrow);
    case "mois-dernier":
      return range(
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)),
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      );
    case "tout":
      return range(null, null);
  }
}

/**
 * Lit la période choisie dans l'adresse (`periode`, et `du` / `au` pour des dates libres).
 * Une période inconnue, non permise ou mal saisie retombe sur `fallback`.
 */
export function resolvePeriod(
  params: SearchParams,
  opts: { fallback: PeriodPreset; allowed?: readonly PeriodPreset[]; now?: Date },
): DateRange {
  const now = opts.now ?? new Date();
  const key = param(params, "periode");

  if (key === CUSTOM_PERIOD) {
    let from = parseDay(param(params, "du"));
    let to = parseDay(param(params, "au")) ?? from;
    if (!from && to) from = to;
    if (from && to) {
      if (from > to) [from, to] = [to, from];
      if (to > dayStart(now)) to = dayStart(now);
      if (from > to) from = to;
      const span = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
      if (span > MAX_CUSTOM_DAYS) from = addDays(to, -(MAX_CUSTOM_DAYS - 1));
      const end = addDays(to, 1);
      return {
        key: CUSTOM_PERIOD,
        from,
        to: end,
        days: Math.round((end.getTime() - from.getTime()) / DAY),
        label: customPeriodLabel(from, to),
        du: formatDayParam(from),
        au: formatDayParam(to),
      };
    }
  }

  const allowed = opts.allowed ?? (Object.keys(PERIOD_PRESETS) as PeriodPreset[]);
  const preset = key && (allowed as readonly string[]).includes(key) ? (key as PeriodPreset) : opts.fallback;
  return presetRange(preset, now);
}

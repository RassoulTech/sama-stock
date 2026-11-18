// src/lib/domain/assistant/periodes.ts
import { CUSTOM_PERIOD, parseDay, resolvePeriod, type DateRange, type PeriodPreset } from "@/lib/filters";

/**
 * Périodes que l'assistant peut demander, traduites vers les filtres des pages (lib/filters). « dates » prend un
 * jour (`du`) ou un intervalle (`du` et `au`, au format AAAA-MM-JJ).
 */
export const PERIODES = ["aujourdhui", "hier", "7jours", "30jours", "mois", "mois_dernier", "90jours", "tout", "dates"] as const;
export type Periode = (typeof PERIODES)[number];

const PRESET: Record<Exclude<Periode, "dates">, PeriodPreset> = {
  aujourdhui: "today",
  hier: "yesterday",
  "7jours": "7j",
  "30jours": "30j",
  mois: "mois",
  mois_dernier: "mois-dernier",
  "90jours": "90j",
  tout: "tout",
};

export interface FiltrePeriode {
  periode: string;
  du?: string;
  au?: string;
}

const DAY = 86_400_000;
const jour = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Paramètres d'adresse pour une page qui n'accepte que certaines périodes. Une période refusée par la page est
 * rendue autrement quand c'est possible (« aujourd'hui » devient un jour précis dans les rapports, « tout » la plus
 * longue période permise), sinon la page garde sa période par défaut (null).
 */
export function filtrePeriode(
  periode: Periode | undefined,
  dates: { du?: string; au?: string },
  permises: readonly PeriodPreset[],
  maintenant = new Date(),
): FiltrePeriode | null {
  if (!periode) return null;
  if (periode === "dates") {
    const du = parseDay(dates.du);
    const au = parseDay(dates.au) ?? du;
    if (!du || !au) return null;
    return { periode: CUSTOM_PERIOD, du: jour(du), au: jour(au) };
  }
  const preset = PRESET[periode];
  if (permises.includes(preset)) return { periode: preset };
  if (preset === "today" || preset === "yesterday") {
    const d = jour(new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()) - (preset === "yesterday" ? DAY : 0)));
    return { periode: CUSTOM_PERIOD, du: d, au: d };
  }
  if (preset === "tout") {
    const plusLongue = (["90j", "30j", "mois", "7j"] as const).find((p) => permises.includes(p));
    return plusLongue ? { periode: plusLongue } : null;
  }
  return null;
}

/** Début, fin et libellé d'une période demandée par l'assistant (pour les lectures côté serveur). */
export function intervalle(periode: Periode | undefined, dates: { du?: string; au?: string }, maintenant = new Date()): DateRange {
  const tous = Object.values(PRESET);
  const filtre = filtrePeriode(periode ?? "aujourdhui", dates, tous, maintenant) ?? { periode: "today" };
  return resolvePeriod({ periode: filtre.periode, du: filtre.du, au: filtre.au }, { fallback: "today", now: maintenant });
}

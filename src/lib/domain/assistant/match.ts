/** Correspondance entre un nom dit au micro (transcrit par l'IA) et les noms enregistrés dans Sama Stock. */

export interface Named {
  id: string;
  name: string;
  phone?: string | null;
}

export type MatchResult<T> = { kind: "one"; item: T } | { kind: "many"; items: T[] } | { kind: "none" };

const MAX_CANDIDATES = 5;

/** Minuscules, sans accents ni ponctuation, espaces simples : « Riz Parfumé (1kg) » → « riz parfume 1kg ». */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nombre de lettres à ajouter, enlever ou changer pour passer d'un mot à l'autre. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** Fautes tolérées selon la longueur du mot : aucune sous 3 lettres, 1 jusqu'à 4, 2 au-delà. */
function tolerance(word: string): number {
  if (word.length < 3) return 0;
  return word.length <= 4 ? 1 : 2;
}

const words = (value: string) => value.split(" ").filter(Boolean);
const digits = (value: string) => value.replace(/\D/g, "");

function result<T>(items: T[]): MatchResult<T> {
  if (items.length === 1) return { kind: "one", item: items[0] };
  if (items.length > 1) return { kind: "many", items: items.slice(0, MAX_CANDIDATES) };
  return { kind: "none" };
}

/**
 * Retrouve un élément par son nom ou, pour un client ou un fournisseur, par la fin de son numéro de téléphone.
 * Ordre : nom identique, puis chaque mot dit retrouvé en début d'un mot du nom, puis avec des fautes proches.
 */
export function findByName<T extends Named>(query: string, items: readonly T[]): MatchResult<T> {
  const q = normalizeName(query);
  if (!q) return { kind: "none" };

  const phone = digits(query);
  if (phone.length >= 6) {
    const byPhone = items.filter((i) => i.phone && digits(i.phone).endsWith(phone.slice(-9)));
    if (byPhone.length) return result(byPhone);
  }

  const named = items.map((item) => ({ item, words: words(normalizeName(item.name)), norm: normalizeName(item.name) }));
  const exact = named.filter((n) => n.norm === q);
  if (exact.length) return result(exact.map((n) => n.item));

  const said = words(q);
  const prefix = named.filter((n) => said.every((w) => n.words.some((x) => x.startsWith(w))));
  if (prefix.length) return result(prefix.map((n) => n.item));

  const fuzzy = named.filter((n) =>
    said.every((w) => n.words.some((x) => x.startsWith(w) || levenshtein(w, x) <= tolerance(w))),
  );
  return result(fuzzy.map((n) => n.item));
}

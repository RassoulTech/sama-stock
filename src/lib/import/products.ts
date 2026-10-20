/**
 * Import de produits depuis un fichier Excel / CSV quelconque.
 * Le fichier du commerçant n'a pas à suivre un modèle : on retrouve la ligne d'en-tête,
 * on rapproche chaque colonne d'un champ (par son titre, sinon par son contenu),
 * on écarte les colonnes inutiles (tailles, montants calculés, anciens comptages)
 * et on nettoie les valeurs (« 15 000 FCFA », « 1,5 kg », « pce »…).
 * Ce module est pur : il sert dans le navigateur (aperçu) et dans les tests.
 */
import { isUnitId, unitLabel, type UnitId } from "@/lib/format";

export const IMPORT_FIELDS = {
  name: "Nom du produit",
  reference: "Référence",
  category: "Catégorie",
  unit: "Unité",
  costPrice: "Prix d'achat",
  salePrice: "Prix de vente",
  stock: "Quantité en stock",
  alertThreshold: "Seuil d'alerte",
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;
export const IMPORT_FIELD_KEYS = Object.keys(IMPORT_FIELDS) as ImportField[];

/** Nombre maximum de lignes lues dans un fichier. */
export const IMPORT_MAX_ROWS = 2000;

/** Lignes envoyées au serveur par lot (le fichier est lu dans le navigateur). */
export const IMPORT_BATCH = 200;

/** Parité fixe du franc CFA : 1 € = 655,957 FCFA. */
export const EUR_TO_FCFA = 655.957;

export type Cell = string | number | boolean | Date | null | undefined;

/** Minuscules, sans accents ni ponctuation, espaces simplifiés. */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Clé de comparaison d'un nom de produit : sans accents ni majuscules, et « 25 kg » = « 25kg ».
 * Sert à repérer les doublons et les produits déjà présents dans le catalogue.
 */
export function productKey(value: unknown): string {
  return normalizeText(value).replace(/(\d) (?=[a-z])/g, "$1");
}

/** Intitulés reconnus pour chaque champ (déjà normalisés), en français, en anglais, abrégés ou en wolof. */
const SYNONYMS: Record<ImportField, string[]> = {
  name: [
    "nom", "nom du produit", "nom produit", "produit", "produits", "designation", "libelle", "article", "articles",
    "intitule", "description", "item", "product", "product name", "name", "nom article", "marchandise",
    "nom de l article", "element", "nom element", "nom de l element", "nom commercial", "libelle article",
    "designation article", "denomination", "modele", "item name", "product description", "tur",
  ],
  reference: [
    "reference", "ref", "references", "code", "code produit", "code article", "sku", "code barre", "code barres",
    "codebarre", "barcode", "ean", "ean13", "upc", "gencod", "ref produit", "ref article", "id produit", "numero", "n article",
    "code interne", "code ean", "reference produit",
  ],
  category: [
    "categorie", "categories", "famille", "rayon", "type", "category", "groupe", "gamme", "sous categorie", "section",
    "classe", "type de produit", "famille de produit", "famille produit", "departement", "collection",
  ],
  unit: ["unite", "unites", "unit", "uom", "mesure", "unite de mesure", "u m", "um", "unite de vente", "unite de comptage"],
  costPrice: [
    "prix d achat", "prix achat", "pa", "p a", "cout", "cout unitaire", "cout d achat", "prix de revient", "cost",
    "cost price", "purchase price", "achat", "prix fournisseur", "prix d achat unitaire", "pau", "prix achat unitaire", "unit cost",
    "prix d achat ht", "pa ht", "cout de revient", "cout achat", "njegu jend", "jend",
  ],
  salePrice: [
    "prix de vente", "prix vente", "pv", "p v", "prix", "tarif", "price", "sale price", "selling price", "prix unitaire",
    "pu", "prix public", "prix ttc", "prix de vente unitaire", "pvu", "vente", "prix client", "prix detail", "prix de detail",
    "prix au detail", "pv ttc", "prix de vente ttc", "prix boutique", "prix magasin", "njeg", "njegu jaay", "jaay",
  ],
  stock: [
    "quantite", "qte", "qt", "stock", "stock initial", "quantity", "qty", "en stock", "disponible", "stock actuel",
    "quantite en stock", "nombre", "nb", "nbre", "stock disponible", "qte en stock", "quantite totale", "stock final",
    "stock physique", "stock reel", "qte disponible", "quantite disponible", "qte dispo", "dispo", "on hand", "nombre d unites", "lim",
  ],
  alertThreshold: [
    "seuil", "seuil d alerte", "seuil alerte", "alerte", "stock min", "stock mini", "stock minimum", "minimum", "min", "mini",
    "seuil mini", "seuil minimum", "reorder point", "stock d alerte", "stock securite", "stock de securite", "quantite minimum",
    "quantite minimale", "seuil de reapprovisionnement", "point de commande", "stock alerte", "alerte stock", "seuil critique", "reorder level",
  ],
};

/** Mots qui orientent un titre vers le prix d'achat ou le prix de vente. */
const COST_WORDS = ["achat", "revient", "cout", "fournisseur", "pa", "cost", "purchase", "ht", "jend"];
const SALE_WORDS = ["vente", "pv", "public", "ttc", "client", "detail", "sale", "selling", "jaay"];
/** Un titre de quantité qui parle d'alerte (« Stock mini ») n'est pas le stock. */
const ALERT_WORDS = ["seuil", "alerte", "min", "mini", "minimum", "minimale", "securite", "reapprovisionnement", "critique", "reorder"];

/** Colonnes à écarter d'office (sauf choix contraire de l'utilisateur). */
export type IgnoredKind = "taille" | "montant" | "historique" | "ventes";

export const IGNORED_LABELS: Record<IgnoredKind, string> = {
  taille: "Ignorée : taille ou contenance",
  montant: "Ignorée : montant calculé",
  historique: "Ignorée : ancien comptage",
  ventes: "Ignorée : historique des ventes",
};

/** Taille, poids, contenance, conditionnement : ce n'est ni le nom ni l'unité de comptage. */
const SIZE_WORDS = ["taille", "contenance", "poids", "volume", "dimension", "dimensions", "format", "conditionnement", "capacite", "grammage"];
/** Valeurs calculées (prix × quantité, totaux, marges) : à ne pas prendre pour un prix. */
const COMPUTED_WORDS = ["valeur", "montant", "marge", "benefice", "chiffre", "ca", "total", "totale", "totaux", "somme"];
const QUANTITY_WORDS = ["quantite", "qte", "quantity", "qty"];
/** Quantités déjà vendues ou sorties : de l'historique, pas le stock. */
const SOLD_WORDS = ["vendu", "vendue", "vendus", "vendues", "ventes", "sold", "sortie", "sorties"];
const PRICE_WORDS = ["prix", "pv", "tarif", "price"];
const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre", "janv", "fevr", "sept", "oct", "nov", "dec"];

/** Comptages successifs : « Semaine 3 », « S4 », « Mois 2 », « Jour 1 », une date, un nom de mois. */
function isPeriodHeader(header: Cell): boolean {
  if (header instanceof Date) return true;
  const h = normalizeText(header);
  if (!h) return false;
  if (/^(semaine|sem|s|mois|jour|j|week|wk|w|month|day|periode|inventaire|releve|comptage)\s?\d{1,2}$/.test(h)) return true;
  if (/^\d{1,2} \d{1,2}( \d{2,4})?$/.test(h)) return true; // 01/10 ou 01/10/2026
  return MONTHS.some((m) => h === m || h.startsWith(`${m} `));
}

/** Pourquoi une colonne doit être écartée, d'après son titre (ou null). */
export function ignoredKind(header: Cell): IgnoredKind | null {
  if (isPeriodHeader(header)) return "historique";
  const words = normalizeText(header).split(" ");
  if (words.some((w) => SIZE_WORDS.includes(w))) return "taille";
  if (words.some((w) => COMPUTED_WORDS.includes(w)) && !words.some((w) => QUANTITY_WORDS.includes(w))) return "montant";
  if (words.some((w) => SOLD_WORDS.includes(w)) && !words.some((w) => PRICE_WORDS.includes(w))) return "ventes";
  return null;
}

/** Distance d'édition (nombre de lettres à changer), pour tolérer les fautes de frappe. */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Même mot, à une faute de frappe près pour les mots longs (« quantiter », « categori »). */
function sameWord(word: string, target: string): boolean {
  if (word === target) return true;
  if (word.length < 5 || target.length < 5) return false;
  return editDistance(word, target) <= (Math.min(word.length, target.length) >= 8 ? 2 : 1);
}

/** Note de 0 à 100 : à quel point un titre de colonne désigne ce champ. */
export function headerScore(header: string, field: ImportField): number {
  const h = normalizeText(header);
  if (!h) return 0;
  const words = h.split(" ");
  let best = 0;
  for (const syn of SYNONYMS[field]) {
    if (h === syn) return 100;
    const synWords = syn.split(" ");
    // Le titre contient tous les mots du synonyme (ex. « Prix de vente (FCFA) »)
    if (synWords.every((w) => words.includes(w))) best = Math.max(best, 60 + Math.min(30, syn.length));
    // … ou presque, avec une faute de frappe (« Quantiter en stok »)
    else if (synWords.every((w) => words.some((x) => sameWord(x, w)))) best = Math.max(best, 55 + Math.min(30, syn.length));
  }
  // Un titre « prix … » sans précision va au prix de vente, sauf indice d'achat
  if (field === "salePrice" && words.includes("prix") && words.some((w) => COST_WORDS.includes(w))) best = Math.min(best, 40);
  if (field === "costPrice" && words.includes("prix") && words.some((w) => SALE_WORDS.includes(w))) best = Math.min(best, 40);
  if (field === "stock" && words.some((w) => ALERT_WORDS.includes(w))) best = Math.min(best, 40);
  return best;
}

/** Ligne d'en-tête : celle (parmi les 15 premières) dont le plus de cellules ressemblent à des titres connus. */
export function detectHeaderRow(rows: Cell[][]): number {
  let bestRow = -1;
  let bestCount = 0;
  rows.slice(0, 15).forEach((row, index) => {
    const count = row.filter(
      (cell) => typeof cell === "string" && (IMPORT_FIELD_KEYS.some((f) => headerScore(cell, f) >= 60) || isPeriodHeader(cell)),
    ).length;
    if (count > bestCount) {
      bestCount = count;
      bestRow = index;
    }
  });
  return bestCount >= 1 ? bestRow : -1;
}

// ── Lecture des valeurs ─────────────────────────────────────────────────────

/**
 * Lit un nombre écrit à la française ou à l'anglaise :
 * « 15 000 », « 15.000 », « 1,5 », « 15k », « 2 500 FCFA », « 20,00 € ».
 */
export function parseNumber(value: Cell): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean" || value instanceof Date) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = value
    .toLowerCase()
    .replace(/(\d)\s*f(?:rs?)?\b/g, "$1") // « 1500F », « 1 500 frs »
    .replace(/f\s?cfa|cfa|xof|francs?|fr\b|\bf\b|€|euros?|\beur\b|\$|\busd\b/g, "")
    .replace(/[\s  ']/g, "")
    .trim();
  let factor = 1;
  if (/^-?[\d.,]+k$/.test(s)) {
    factor = 1000;
    s = s.slice(0, -1);
  } else if (/^-?[\d.,]+m$/.test(s)) {
    factor = 1_000_000;
    s = s.slice(0, -1);
  }
  if (!/^-?[\d.,]+$/.test(s)) return null;
  // Séparateurs de milliers : 15.000 / 15,000 / 1.500.000
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s) && factor === 1) {
    const seps = new Set(s.replace(/[\d-]/g, ""));
    if (seps.size === 1) s = s.replace(/[.,]/g, "");
  }
  // Deux séparateurs différents : le dernier est la décimale (1.234,50 ou 1,234.50)
  if (/[.,].*[.,]/.test(s)) {
    const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    s = s.slice(0, last).replace(/[.,]/g, "") + "." + s.slice(last + 1);
  }
  s = s.replace(",", ".");
  const n = Number(s) * factor;
  return Number.isFinite(n) ? n : null;
}

export function parseMoney(value: Cell, factor = 1): number | null {
  const n = parseNumber(value);
  return n === null || n < 0 ? null : Math.round(n * factor);
}

export function parseQuantity(value: Cell): number | null {
  const n = parseNumber(value);
  return n === null || n < 0 ? null : Math.round(n * 1000) / 1000;
}

/** Le montant est-il écrit en euros (« 20,00 € », « 15 EUR ») ? */
export function looksLikeEuro(value: Cell): boolean {
  return typeof value === "string" && /€|\beuros?\b|\beur\b/i.test(value);
}

const UNIT_SYNONYMS: Record<UnitId, string[]> = {
  piece: ["piece", "pieces", "pce", "pces", "pc", "pcs", "unite", "unites", "u", "un", "article", "articles", "unit", "units", "ea", "each"],
  kg: ["kg", "kgs", "kilo", "kilos", "kilogramme", "kilogrammes", "kilogram"],
  g: ["g", "gr", "grs", "gramme", "grammes", "gram"],
  m: ["m", "metre", "metres", "meter", "mt"],
  l: ["l", "litre", "litres", "lt", "liter", "ltr"],
  sac: ["sac", "sacs", "bag", "bags"],
  carton: ["carton", "cartons", "ctn", "caisse", "caisses", "box"],
  paquet: ["paquet", "paquets", "pqt", "pack", "packs", "paq"],
  boite: ["boite", "boites", "bte", "btes", "boitier"],
  rouleau: ["rouleau", "rouleaux", "rlx", "roll"],
  sachet: ["sachet", "sachets", "sct"],
  bouteille: ["bouteille", "bouteilles", "btl", "flacon", "flacons", "bottle"],
  paire: ["paire", "paires", "pair", "pairs"],
  lot: ["lot", "lots", "kit", "kits"],
};

/** Contenants qui servent d'unité de comptage quand ils ouvrent une description (« Sac de 11 kg »). */
const CONTAINERS: UnitId[] = ["sac", "carton", "paquet", "boite", "rouleau", "sachet", "bouteille", "paire", "lot"];

function unitFromWord(word: string): UnitId | null {
  if (isUnitId(word)) return word;
  for (const [id, words] of Object.entries(UNIT_SYNONYMS) as [UnitId, string[]][]) {
    if (words.includes(word)) return id;
  }
  return null;
}

/**
 * « Pièce », « pcs », « kilo », « btl »… → identifiant d'unité, ou null si inconnue.
 * « Sac de 50 kg » ou « Carton de 12 » donnent le contenant (sac, carton).
 */
export function parseUnit(value: Cell): UnitId | null {
  const v = normalizeText(value);
  if (!v) return null;
  const exact = unitFromWord(v);
  if (exact) return exact;
  const first = unitFromWord(v.split(" ")[0]!);
  return first && CONTAINERS.includes(first) ? first : null;
}

/** Contenant indiqué dans une colonne de taille (« Sac de 11 kg » → sac), sinon null : « 3,5 litres » reste une pièce. */
export function containerFromSize(value: Cell): UnitId | null {
  const first = unitFromWord(normalizeText(value).split(" ")[0] ?? "");
  return first && CONTAINERS.includes(first) ? first : null;
}

const SOLD_BY = /\b(?:au|le|par)\s(kg|kgs|kilo|kilos|kilogramme|litre|litres|l|metre|metres|m|gramme|grammes|g)\b/;
const CONTAINER_OF = /\b(sacs?|cartons?|caisses?|paquets?|packs?|boites?|rouleaux?|sachets?|bouteilles?|paires?|lots?)\s(?:de|d)\b/;

/** Unité lue dans le nom : « Tissu wax au mètre » → m, « Riz sac de 25 kg » → sac, « Paire de sandales » → paire. */
export function unitFromName(name: string): UnitId | null {
  const n = normalizeText(name);
  const by = SOLD_BY.exec(n);
  if (by) return unitFromWord(by[1]!);
  const c = CONTAINER_OF.exec(n);
  const unit = c ? unitFromWord(c[1]!) : null;
  return unit && CONTAINERS.includes(unit) ? unit : null;
}

/** « 2 cartons », « 12 pcs », « 1,5 kg » : la quantité et, si elle est écrite, l'unité. */
export function parseQuantityWithUnit(value: Cell): { quantity: number | null; unit: UnitId | null; negative: boolean } {
  const n = parseNumber(value);
  if (n !== null) return { quantity: n < 0 ? null : Math.round(n * 1000) / 1000, unit: null, negative: n < 0 };
  const m = typeof value === "string" ? /^\s*([\d\s.,  ]+?)\s*([a-zA-Zà-ÿÀ-Ý]+)\.?\s*$/.exec(value) : null;
  if (m) {
    const unit = unitFromWord(normalizeText(m[2]));
    const q = parseNumber(m[1]!);
    if (unit && q !== null && q >= 0) return { quantity: Math.round(q * 1000) / 1000, unit, negative: false };
  }
  return { quantity: null, unit: null, negative: false };
}

const ACCENTED: Record<string, string> = { piece: "pièce", pieces: "pièces", metre: "mètre", metres: "mètres", boite: "boîte", boites: "boîtes" };

/** Autres façons d'écrire chaque unité (pour le mode d'emploi du modèle). */
export function unitAliases(unit: UnitId): string[] {
  const label = normalizeText(unitLabel(unit, 1));
  return UNIT_SYNONYMS[unit]
    .filter((w) => w !== unit && w !== label && w.length > 1)
    .slice(0, 4)
    .map((w) => ACCENTED[w] ?? w);
}

/** « BOISSONS : » → « Boissons » ; les autres libellés restent tels quels. */
export function tidyLabel(value: string): string {
  const t = value.replace(/\s+/g, " ").trim().replace(/\s*:+$/, "");
  return /\p{Lu}{3}/u.test(t) && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

// ── Correspondance automatique des colonnes ─────────────────────────────────

export interface ColumnGuess {
  field: ImportField | null;
  /** « titre » : reconnu par le titre ; « contenu » : deviné d'après les valeurs ; « memoire » : choix fait au dernier import. */
  source: "titre" | "contenu" | "memoire" | null;
  /** Colonne écartée d'office, et pourquoi. */
  ignored: IgnoredKind | null;
  /** Précision affichée (ex. « dernier comptage »). */
  note?: string;
}

function columnValues(rows: Cell[][], col: number): Cell[] {
  return rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
}

/** Associe chaque colonne à un champ : d'abord par les titres, puis d'après le contenu pour les champs essentiels. */
export function autoMap(headers: Cell[], rows: Cell[][]): ColumnGuess[] {
  const n = Math.max(headers.length, ...rows.slice(0, 50).map((r) => r.length), 0);
  const guesses: ColumnGuess[] = Array.from({ length: n }, (_, col) => ({
    field: null,
    source: null,
    ignored: ignoredKind(headers[col]),
  }));
  const taken = new Set<ImportField>();

  // 1. Titres : meilleures correspondances d'abord, un champ par colonne
  const candidates: { col: number; field: ImportField; score: number }[] = [];
  headers.forEach((h, col) => {
    if (guesses[col]!.ignored || (typeof h !== "string" && typeof h !== "number")) return;
    for (const field of IMPORT_FIELD_KEYS) {
      const score = headerScore(String(h), field);
      if (score >= 60) candidates.push({ col, field, score });
    }
  });
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (guesses[c.col]!.field || taken.has(c.field)) continue;
    guesses[c.col] = { field: c.field, source: "titre", ignored: null };
    taken.add(c.field);
  }

  // 2. Comptages successifs (Semaine 1…4) : le dernier donne le stock actuel
  const periods = guesses.map((g, col) => (g.ignored === "historique" ? col : -1)).filter((c) => c >= 0);
  if (!taken.has("stock") && periods.length > 0) {
    const last = [...periods].reverse().find((c) => columnValues(rows, c).some((v) => parseNumber(v) !== null)) ?? periods[periods.length - 1]!;
    guesses[last] = { field: "stock", source: "contenu", ignored: null, note: "dernier comptage" };
    taken.add("stock");
  }

  // 3. Contenu des colonnes restantes (jamais celles écartées d'office)
  const sample = rows.slice(0, 200);
  const stats = guesses.map((g, col) => {
    const values = columnValues(sample, col);
    const numbers = values.map((v) => parseNumber(v)).filter((x): x is number => x !== null);
    const texts = values.filter((v) => typeof v === "string" && parseNumber(v) === null) as string[];
    const units = values.filter((v) => parseUnit(v) !== null).length;
    const distinct = new Set(values.map((v) => normalizeText(v))).size;
    return {
      col,
      free: !g.field && !g.ignored,
      count: values.length,
      numericRatio: values.length ? numbers.length / values.length : 0,
      textRatio: values.length ? texts.length / values.length : 0,
      unitRatio: values.length ? units / values.length : 0,
      distinctRatio: values.length ? distinct / values.length : 0,
      avgLength: texts.length ? texts.reduce((s, t) => s + t.length, 0) / texts.length : 0,
      hasSpaces: texts.some((t) => /\s/.test(t.trim())),
      median: median(numbers),
    };
  });
  const assign = (col: number, field: ImportField) => {
    guesses[col] = { field, source: "contenu", ignored: null };
    taken.add(field);
    stats[col]!.free = false;
  };
  const free = () => stats.filter((s) => s.free && s.count > 0);

  if (!taken.has("unit")) {
    const c = free().find((s) => s.unitRatio >= 0.6 && s.numericRatio < 0.5);
    if (c) assign(c.col, "unit");
  }
  if (!taken.has("name")) {
    const c = free()
      .filter((s) => s.textRatio >= 0.6 && s.avgLength >= 3)
      .sort((a, b) => b.distinctRatio * b.avgLength - a.distinctRatio * a.avgLength)[0];
    if (c) assign(c.col, "name");
  }
  if (!taken.has("category")) {
    const c = free().find((s) => s.textRatio >= 0.6 && s.distinctRatio <= 0.7 && s.distinctRatio < 1 && s.count >= 4);
    if (c) assign(c.col, "category");
  }
  if (!taken.has("reference")) {
    const c = free().find(
      (s) => s.distinctRatio >= 0.95 && !s.hasSpaces && ((s.textRatio >= 0.6 && s.avgLength <= 20) || (s.numericRatio >= 0.9 && s.median > 100_000)),
    );
    if (c) assign(c.col, "reference");
  }
  // Prix : colonnes de nombres assez grands ; le plus élevé est le prix de vente
  const priceCols = free()
    .filter((s) => s.numericRatio >= 0.8 && s.median >= 25)
    .sort((a, b) => b.median - a.median);
  if (!taken.has("salePrice") && !taken.has("costPrice") && priceCols.length >= 2) {
    assign(priceCols[0]!.col, "salePrice");
    assign(priceCols[1]!.col, "costPrice");
  } else if (!taken.has("salePrice") && priceCols.length >= 1) {
    const costCol = guesses.findIndex((g) => g.field === "costPrice");
    const costMedian = costCol >= 0 ? median(columnValues(sample, costCol).map((v) => parseNumber(v)).filter((x): x is number => x !== null)) : 0;
    const c = priceCols.find((s) => s.median >= costMedian);
    if (c) assign(c.col, "salePrice");
  }
  return guesses;
}

/** Les montants des colonnes de prix sont-ils écrits en euros ? */
export function detectEuro(displayRows: Cell[][], mapping: (ImportField | null)[]): boolean {
  const cols = mapping.map((f, i) => (f === "costPrice" || f === "salePrice" ? i : -1)).filter((i) => i >= 0);
  return displayRows.slice(0, 100).some((r) => cols.some((c) => looksLikeEuro(r[c])));
}

/** Conversion des euros proposée d'office seulement si les prix sont petits (de vrais euros, pas des FCFA mal étiquetés). */
export function shouldConvertEuro(rows: Cell[][], mapping: (ImportField | null)[]): boolean {
  const cols = mapping.map((f, i) => (f === "costPrice" || f === "salePrice" ? i : -1)).filter((i) => i >= 0);
  const values = rows.flatMap((r) => cols.map((c) => parseNumber(r[c]))).filter((x): x is number => x !== null && x > 0);
  return values.length > 0 && median(values) < 500;
}

// ── Construction des lignes à importer ──────────────────────────────────────

export interface ImportRow {
  /** Numéro de ligne dans le fichier (comme dans Excel). */
  line: number;
  name: string;
  reference: string;
  category: string;
  unit: UnitId;
  costPrice: number;
  salePrice: number;
  stock: number;
  alertThreshold: number;
  warnings: string[];
  /** Ligne écartée (et pourquoi). */
  error: string | null;
  /** Ce que Sama Stock a déduit lui-même (affiché dans l'aperçu). */
  derived: {
    unit?: "nom" | "quantite" | "taille";
    salePrice?: boolean;
    category?: boolean;
  };
}

const text = (v: Cell) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());

const FOOTER = /©|\bcopyright\b|tous droits reserves/i;
const TOTAL = /^(total|totaux|sous total|grand total|montant total|total general)\b/;
/** Lignes d'exemple du modèle Sama Stock : jamais importées. */
const EXAMPLE = /\(\s*exemple\s*\)\s*$/i;
/** « Sans catégorie » (export Sama Stock), « Aucune », « N/A » : pas de catégorie. */
const NO_CATEGORY_WORDS = ["sans categorie", "aucune", "aucune categorie", "non classe", "non classee", "n a", "na", "none"];

export interface BuildOptions {
  /** Colonne de taille dont on tire le contenant quand il n'y a pas de colonne d'unité. */
  sizeColumn?: number;
  /** Multiplicateur des prix (ex. 655,957 pour convertir des euros). */
  priceFactor?: number;
  /** Prix de vente manquant : prix d'achat + ce pourcentage, arrondi aux 25 FCFA supérieurs. */
  marginPercent?: number;
  /** Titres de section (« BOISSONS ») utilisés comme catégorie des lignes qui suivent (oui par défaut). */
  sections?: boolean;
}

const roundUp25 = (n: number) => Math.ceil(n / 25) * 25;

/**
 * Transforme les lignes du fichier en produits prêts à importer.
 * `firstLine` est le numéro (Excel) de la première ligne de données.
 */
export function buildRows(rows: Cell[][], mapping: (ImportField | null)[], firstLine: number, opts: BuildOptions = {}): ImportRow[] {
  const col = (field: ImportField) => mapping.indexOf(field);
  const get = (row: Cell[], field: ImportField): Cell => (col(field) >= 0 ? row[col(field)] : null);
  const factor = opts.priceFactor ?? 1;
  const nameCol = col("name");
  const seen = new Map<string, number>();
  const out: ImportRow[] = [];

  const data = rows.slice(0, IMPORT_MAX_ROWS);
  const cellsOf = data.map((row) => row.map(text));
  const filled = cellsOf.map((cells) => cells.filter((c) => c !== ""));
  const numericCols = (["costPrice", "salePrice", "stock", "alertThreshold"] as const).map(col).filter((c) => c >= 0);
  const hasNumbers = (i: number) => numericCols.some((c) => cellsOf[i]![c] !== "" && parseNumber(data[i]![c]) !== null);
  // Part des lignes de produits qui portent des chiffres : un fichier « liste de noms » n'a pas de titres de section
  const multi = data.map((_, i) => i).filter((i) => filled[i]!.length >= 2);
  const numberedRatio = multi.length ? multi.filter(hasNumbers).length / multi.length : 0;

  /** Ligne-titre d'un groupe de produits (« BOISSONS », « Riz : »), qui sert de catégorie aux lignes suivantes. */
  const isSection = (i: number) => {
    if (opts.sections === false || numericCols.length === 0 || filled[i]!.length !== 1) return false;
    const t = filled[i]![0]!;
    const where = cellsOf[i]!.indexOf(t);
    if (/\d/.test(t) || t.length < 2 || t.length > 50 || numericCols.includes(where)) return false;
    if (TOTAL.test(normalizeText(t)) || FOOTER.test(t) || EXAMPLE.test(t)) return false;
    const shouting = /\p{Lu}{3}/u.test(t) && t === t.toUpperCase();
    if (shouting || t.endsWith(":") || where !== nameCol) return true;
    // Libellé simple : précédé d'une ligne vide (ou en tête) et suivi d'un vrai produit chiffré
    const prevBlank = i === 0 || filled[i - 1]!.length === 0;
    let j = i + 1;
    while (j < data.length && filled[j]!.length === 0) j++;
    return numberedRatio >= 0.8 && prevBlank && j < data.length && filled[j]!.length >= 2 && hasNumbers(j);
  };

  let section = "";
  data.forEach((row, i) => {
    const cells = cellsOf[i]!;
    if (filled[i]!.length === 0) return;
    // Pied de page (« © 2025 ») : ignoré sans bruit
    if (cells.some((c) => FOOTER.test(c))) return;
    if (isSection(i)) {
      section = tidyLabel(filled[i]![0]!);
      return;
    }
    const name = text(get(row, "name")).slice(0, 120);
    // Sans nom et sans montant non nul (cases à 0 des lignes vides d'un modèle) : rien à signaler
    if (!name && !cells.some((c) => /[1-9]/.test(c))) return;
    if (EXAMPLE.test(name)) return;

    const line = firstLine + i;
    const warnings: string[] = [];
    const derived: ImportRow["derived"] = {};

    // Quantités : « 2 cartons » donne aussi l'unité
    const qty = (field: "stock" | "alertThreshold") => {
      const raw = get(row, field);
      if (!text(raw)) return { value: 0, unit: null };
      const q = parseQuantityWithUnit(raw);
      if (q.quantity === null) {
        warnings.push(q.negative ? `${IMPORT_FIELDS[field]} négatif(ve) : 0 utilisé` : `${IMPORT_FIELDS[field]} « ${text(raw)} » illisible : 0 utilisé`);
        return { value: 0, unit: null };
      }
      return { value: Math.min(q.quantity, 10_000_000), unit: q.unit };
    };
    const stockQ = qty("stock");
    const alertQ = qty("alertThreshold");

    let unit: UnitId = "piece";
    const rawUnit = get(row, "unit");
    if (text(rawUnit)) {
      const parsed = parseUnit(rawUnit);
      if (parsed) unit = parsed;
      else warnings.push(`Unité « ${text(rawUnit)} » inconnue : « pièce » utilisée`);
    } else {
      const fromSize = opts.sizeColumn !== undefined ? containerFromSize(row[opts.sizeColumn]) : null;
      const fromQty = stockQ.unit ?? alertQ.unit;
      const fromName = unitFromName(name);
      if (fromSize) [unit, derived.unit] = [fromSize, "taille"];
      else if (fromQty) [unit, derived.unit] = [fromQty, "quantite"];
      else if (fromName) [unit, derived.unit] = [fromName, "nom"];
    }

    const round = (v: number, field: "stock" | "alertThreshold") => {
      if (Number.isInteger(v) || ["kg", "g", "m", "l"].includes(unit)) return v;
      warnings.push(`${IMPORT_FIELDS[field]} arrondi(e) à ${Math.round(v)} (unité sans virgule)`);
      return Math.round(v);
    };
    const stock = round(stockQ.value, "stock");
    const alertThreshold = round(alertQ.value, "alertThreshold");

    const money = (field: "costPrice" | "salePrice") => {
      const raw = get(row, field);
      if (!text(raw)) return 0;
      const v = parseMoney(raw, factor);
      if (v === null) {
        warnings.push(`${IMPORT_FIELDS[field]} « ${text(raw)} » illisible : 0 utilisé`);
        return 0;
      }
      return v;
    };
    const costPrice = money("costPrice");
    let salePrice = money("salePrice");
    if (salePrice === 0 && costPrice > 0 && opts.marginPercent !== undefined) {
      salePrice = roundUp25(costPrice * (1 + opts.marginPercent / 100));
      derived.salePrice = true;
    } else if (col("salePrice") >= 0 && salePrice === 0 && !text(get(row, "salePrice"))) {
      warnings.push("Prix de vente manquant : 0 utilisé");
    }
    if (costPrice > 0 && salePrice > 0 && costPrice > salePrice) warnings.push("Prix d'achat supérieur au prix de vente");

    let category = tidyLabel(text(get(row, "category"))).slice(0, 60);
    if (NO_CATEGORY_WORDS.includes(normalizeText(category))) category = "";
    if (!category && section) {
      category = section.slice(0, 60);
      derived.category = true;
    }

    let error: string | null = null;
    if (TOTAL.test(normalizeText(name))) error = "Ligne de total";
    else if (name.length < 2) error = "Nom du produit manquant";
    else {
      const key = productKey(name);
      const first = seen.get(key);
      if (first !== undefined) error = `En double dans le fichier (déjà ligne ${first})`;
      else seen.set(key, line);
    }

    out.push({
      line,
      name,
      reference: text(get(row, "reference")).slice(0, 60),
      category,
      unit,
      costPrice: Math.min(costPrice, 1_000_000_000),
      salePrice: Math.min(salePrice, 1_000_000_000),
      stock,
      alertThreshold,
      warnings,
      error,
      derived,
    });
  });
  return out;
}

// ── Choix de la feuille et mémoire des réglages ─────────────────────────────

/** Note d'une feuille : ses titres reconnus, ses produits lisibles et son nom. */
export function sheetScore(rows: Cell[][], name = ""): number {
  const header = detectHeaderRow(rows);
  const headers = header >= 0 ? rows[header]! : [];
  const matches = headers.filter((h) => typeof h === "string" && IMPORT_FIELD_KEYS.some((f) => headerScore(h, f) >= 60)).length;
  const data = rows.slice(header + 1);
  const mapping = autoMap(headers, data).map((g) => g.field);
  const valid = mapping.includes("name") ? buildRows(data, mapping, 1).filter((r) => !r.error).length : 0;
  const n = normalizeText(name);
  const bonus = /produit|stock|article|catalogue|inventaire|liste/.test(n) ? 15 : /mode d emploi|aide|instruction|resume|unite|vente/.test(n) ? -40 : 0;
  return matches * 10 + Math.min(valid, 500) + bonus;
}

/** La feuille qui ressemble le plus à une liste de produits (la première en cas d'égalité). */
export function pickBestSheet(sheets: { name: string; rows: Cell[][] }[]): number {
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  sheets.forEach((s, i) => {
    const score = sheetScore(s.rows, s.name);
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  return best;
}

/** Empreinte des titres d'un fichier : un fichier de même forme reprend les choix du dernier import. */
export function headerSignature(headers: Cell[]): string {
  const h = headers.map((x) => normalizeText(x));
  return h.filter(Boolean).length >= 2 ? h.join("|") : "";
}

/** Applique une correspondance enregistrée lors d'un import précédent. */
export function applySavedMapping(guesses: ColumnGuess[], saved: (ImportField | null)[] | undefined): ColumnGuess[] {
  if (!saved || saved.length !== guesses.length) return guesses;
  return guesses.map((g, i) => {
    const field = saved[i] ?? null;
    if (field === g.field) return g;
    return field ? { field, source: "memoire", ignored: null } : { field: null, source: null, ignored: g.ignored };
  });
}

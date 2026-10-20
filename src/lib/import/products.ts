/**
 * Import de produits depuis un fichier Excel / CSV quelconque.
 * Le fichier du commerçant n'a pas à suivre un modèle : on retrouve la ligne d'en-tête,
 * on rapproche chaque colonne d'un champ (par son titre, sinon par son contenu),
 * on écarte les colonnes inutiles (tailles, montants calculés, anciens comptages)
 * et on nettoie les valeurs (« 15 000 FCFA », « 1,5 kg », « pce »…).
 * Ce module est pur : il sert dans le navigateur (aperçu) et dans les tests.
 */
import { isUnitId, type UnitId } from "@/lib/format";

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

/** Intitulés reconnus pour chaque champ (déjà normalisés). */
const SYNONYMS: Record<ImportField, string[]> = {
  name: [
    "nom", "nom du produit", "nom produit", "produit", "produits", "designation", "libelle", "article", "articles",
    "intitule", "description", "item", "product", "product name", "name", "nom article", "marchandise",
    "nom de l article", "element", "nom element", "nom de l element",
  ],
  reference: [
    "reference", "ref", "references", "code", "code produit", "code article", "sku", "code barre", "code barres",
    "codebarre", "barcode", "ean", "gencod", "ref produit", "id produit", "numero", "n article",
  ],
  category: ["categorie", "categories", "famille", "rayon", "type", "category", "groupe", "gamme", "sous categorie", "section", "classe"],
  unit: ["unite", "unites", "unit", "uom", "mesure", "unite de mesure", "u m", "um", "unite de vente"],
  costPrice: [
    "prix d achat", "prix achat", "pa", "p a", "cout", "cout unitaire", "cout d achat", "prix de revient", "cost",
    "cost price", "purchase price", "achat", "prix fournisseur", "prix d achat unitaire", "pau", "prix achat unitaire", "unit cost",
  ],
  salePrice: [
    "prix de vente", "prix vente", "pv", "p v", "prix", "tarif", "price", "sale price", "selling price", "prix unitaire",
    "pu", "prix public", "prix ttc", "prix de vente unitaire", "pvu", "vente", "prix client", "prix detail",
  ],
  stock: [
    "quantite", "qte", "qt", "stock", "stock initial", "quantity", "qty", "en stock", "disponible", "stock actuel",
    "quantite en stock", "nombre", "nb", "stock disponible", "qte en stock", "quantite totale", "stock final",
  ],
  alertThreshold: [
    "seuil", "seuil d alerte", "seuil alerte", "alerte", "stock min", "stock mini", "stock minimum", "minimum", "min", "mini",
    "seuil mini", "seuil minimum", "reorder point", "stock d alerte", "stock securite", "stock de securite", "quantite minimum",
  ],
};

/** Mots qui orientent un titre vers le prix d'achat ou le prix de vente. */
const COST_WORDS = ["achat", "revient", "cout", "fournisseur", "pa", "cost", "purchase", "ht"];
const SALE_WORDS = ["vente", "pv", "public", "ttc", "client", "detail", "sale", "selling"];

/** Colonnes à écarter d'office (sauf choix contraire de l'utilisateur). */
export type IgnoredKind = "taille" | "montant" | "historique";

export const IGNORED_LABELS: Record<IgnoredKind, string> = {
  taille: "Ignorée : taille ou contenance",
  montant: "Ignorée : montant calculé",
  historique: "Ignorée : ancien comptage",
};

/** Taille, poids, contenance, conditionnement : ce n'est ni le nom ni l'unité de comptage. */
const SIZE_WORDS = ["taille", "contenance", "poids", "volume", "dimension", "dimensions", "format", "conditionnement", "capacite", "grammage"];
/** Valeurs calculées (prix × quantité, totaux, marges) : à ne pas prendre pour un prix. */
const COMPUTED_WORDS = ["valeur", "montant", "marge", "benefice", "chiffre", "ca", "total", "totale", "totaux", "somme"];
const QUANTITY_WORDS = ["quantite", "qte", "quantity", "qty"];
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
  return null;
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
  }
  // Un titre « prix … » sans précision va au prix de vente, sauf indice d'achat
  if (field === "salePrice" && words.includes("prix") && words.some((w) => COST_WORDS.includes(w))) best = Math.min(best, 40);
  if (field === "costPrice" && words.includes("prix") && words.some((w) => SALE_WORDS.includes(w))) best = Math.min(best, 40);
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

// ── Correspondance automatique des colonnes ─────────────────────────────────

export interface ColumnGuess {
  field: ImportField | null;
  /** « titre » : reconnu par le titre ; « contenu » : deviné d'après les valeurs. */
  source: "titre" | "contenu" | null;
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
}

const text = (v: Cell) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());

const FOOTER = /©|\bcopyright\b|tous droits reserves/i;
const TOTAL = /^(total|totaux|sous total|grand total|montant total|total general)\b/;

export interface BuildOptions {
  /** Colonne de taille dont on tire le contenant quand il n'y a pas de colonne d'unité. */
  sizeColumn?: number;
  /** Multiplicateur des prix (ex. 655,957 pour convertir des euros). */
  priceFactor?: number;
}

/**
 * Transforme les lignes du fichier en produits prêts à importer.
 * `firstLine` est le numéro (Excel) de la première ligne de données.
 */
export function buildRows(rows: Cell[][], mapping: (ImportField | null)[], firstLine: number, opts: BuildOptions = {}): ImportRow[] {
  const col = (field: ImportField) => mapping.indexOf(field);
  const get = (row: Cell[], field: ImportField): Cell => (col(field) >= 0 ? row[col(field)] : null);
  const factor = opts.priceFactor ?? 1;
  const seen = new Map<string, number>();
  const out: ImportRow[] = [];

  rows.slice(0, IMPORT_MAX_ROWS).forEach((row, i) => {
    const cells = row.map(text);
    if (cells.every((c) => c === "")) return;
    // Pied de page (« © 2025 ») et lignes de modèle vides (« € » seul) : ignorés sans bruit
    if (cells.some((c) => FOOTER.test(c))) return;
    const name = text(get(row, "name")).slice(0, 120);
    // Sans nom et sans montant non nul (cases à 0 des lignes vides d'un modèle) : rien à signaler
    if (!name && !cells.some((c) => /[1-9]/.test(c))) return;

    const line = firstLine + i;
    const warnings: string[] = [];

    let unit: UnitId = "piece";
    const rawUnit = get(row, "unit");
    if (text(rawUnit)) {
      const parsed = parseUnit(rawUnit);
      if (parsed) unit = parsed;
      else warnings.push(`Unité « ${text(rawUnit)} » inconnue : « pièce » utilisée`);
    } else if (opts.sizeColumn !== undefined) {
      unit = containerFromSize(row[opts.sizeColumn]) ?? "piece";
    }

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
    const salePrice = money("salePrice");
    if (col("salePrice") >= 0 && salePrice === 0 && !text(get(row, "salePrice"))) warnings.push("Prix de vente manquant : 0 utilisé");
    if (costPrice > 0 && salePrice > 0 && costPrice > salePrice) warnings.push("Prix d'achat supérieur au prix de vente");

    const qty = (field: "stock" | "alertThreshold") => {
      const raw = get(row, field);
      if (!text(raw)) return 0;
      let v = parseQuantity(raw);
      if (v === null) {
        warnings.push(`${IMPORT_FIELDS[field]} « ${text(raw)} » illisible : 0 utilisé`);
        return 0;
      }
      if (!Number.isInteger(v) && !["kg", "g", "m", "l"].includes(unit)) {
        warnings.push(`${IMPORT_FIELDS[field]} arrondi(e) à ${Math.round(v)} (unité sans virgule)`);
        v = Math.round(v);
      }
      return Math.min(v, 10_000_000);
    };
    const stock = qty("stock");
    const alertThreshold = qty("alertThreshold");

    let error: string | null = null;
    if (TOTAL.test(normalizeText(name))) error = "Ligne de total";
    else if (name.length < 2) error = "Nom du produit manquant";
    else {
      const key = normalizeText(name);
      const first = seen.get(key);
      if (first !== undefined) error = `En double dans le fichier (déjà ligne ${first})`;
      else seen.set(key, line);
    }

    out.push({
      line,
      name,
      reference: text(get(row, "reference")).slice(0, 60),
      category: text(get(row, "category")).slice(0, 60),
      unit,
      costPrice: Math.min(costPrice, 1_000_000_000),
      salePrice: Math.min(salePrice, 1_000_000_000),
      stock,
      alertThreshold,
      warnings,
      error,
    });
  });
  return out;
}

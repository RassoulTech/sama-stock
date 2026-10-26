/** Devis et factures d'une boutique : statuts, numéros, TVA et somme en lettres. */

export const DOCUMENT_TYPES = { devis: "Devis", facture: "Facture" } as const;
export type DocumentType = keyof typeof DOCUMENT_TYPES;

export const QUOTE_STATUSES = ["en_cours", "accepte", "refuse", "converti"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const INVOICE_STATUSES = ["emise", "annulee"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Statut affiché : un devis en cours dont la date de validité est passée est « expiré ». */
export type QuoteDisplayStatus = QuoteStatus | "expire";

export const QUOTE_STATUS_LABELS: Record<QuoteDisplayStatus, string> = {
  en_cours: "En cours",
  accepte: "Accepté",
  refuse: "Refusé",
  converti: "Transformé en vente",
  expire: "Expiré",
};

export const QUOTE_STATUS_TONES: Record<QuoteDisplayStatus, "green" | "saffron" | "red" | "gray" | "blue"> = {
  en_cours: "blue",
  accepte: "green",
  refuse: "red",
  converti: "green",
  expire: "gray",
};

export function isQuoteStatus(value: string): value is QuoteStatus {
  return (QUOTE_STATUSES as readonly string[]).includes(value);
}

export function quoteDisplayStatus(status: string, validUntil: Date | null, now = new Date()): QuoteDisplayStatus {
  const s = isQuoteStatus(status) ? status : "en_cours";
  if (s === "en_cours" && validUntil && validUntil.getTime() < now.getTime()) return "expire";
  return s;
}

export const DEFAULT_QUOTE_VALIDITY_DAYS = 15;

/** Date de validité proposée pour un nouveau devis (AAAA-MM-JJ ; l'heure de Dakar est l'heure UTC). */
export function defaultValidUntil(days: number, now = new Date()): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}
export const VAT_RATES = [0, 18] as const;
export type VatRate = (typeof VAT_RATES)[number];

export function isVatRate(value: number): value is VatRate {
  return (VAT_RATES as readonly number[]).includes(value);
}

/** DEV-2026-0001, FAC-2026-0001 : suite continue par commerce, par type et par année. */
export function documentNumber(type: DocumentType, year: number, sequence: number): string {
  return `${type === "devis" ? "DEV" : "FAC"}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function documentPrefix(type: DocumentType, year: number): string {
  return `${type === "devis" ? "DEV" : "FAC"}-${year}-`;
}

/** Année au Sénégal (les numéros changent d'année à minuit, heure de Dakar). */
export function dakarYear(date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dakar", year: "numeric" }).format(date));
}

export interface PricedDocLine {
  lineTotal: number;
}

export interface VatBreakdown {
  /** Total de chaque ligne hors taxe (égal au TTC sans TVA). */
  linesHT: number[];
  discountHT: number;
  deliveryHT: number;
  totalHT: number;
  vat: number;
  totalTTC: number;
}

const ht = (ttc: number, rate: number) => (rate > 0 ? Math.round(ttc / (1 + rate / 100)) : ttc);

/**
 * Les prix de la boutique sont TTC. Le HT de chaque ligne est arrondi au franc ; la TVA est la différence entre le
 * total TTC (exact, celui encaissé) et le total HT (somme de ce qui est imprimé).
 */
export function vatBreakdown(lines: PricedDocLine[], discount: number, deliveryFee: number, rate: number): VatBreakdown {
  const totalTTC = lines.reduce((s, l) => s + l.lineTotal, 0) - discount + deliveryFee;
  const linesHT = lines.map((l) => ht(l.lineTotal, rate));
  const discountHT = ht(discount, rate);
  const deliveryHT = ht(deliveryFee, rate);
  const totalHT = linesHT.reduce((s, v) => s + v, 0) - discountHT + deliveryHT;
  return { linesHT, discountHT, deliveryHT, totalHT, vat: totalTTC - totalHT, totalTTC };
}

const UNITS_FR = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const TENS_FR = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function belowHundred(n: number): string {
  if (n < 20) return UNITS_FR[n]!;
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  const base = TENS_FR[ten]!;
  // 70-79 et 90-99 : soixante-dix, soixante et onze, quatre-vingt-dix…
  if (ten === 7 || ten === 9) return ten === 7 && unit === 1 ? "soixante et onze" : `${base}-${UNITS_FR[10 + unit]}`;
  if (unit === 0) return ten === 8 ? "quatre-vingts" : base;
  if (unit === 1 && ten !== 8) return `${base} et un`;
  return `${base}-${UNITS_FR[unit]}`;
}

function belowThousand(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (hundred === 0) return belowHundred(rest);
  const head = hundred === 1 ? "cent" : `${UNITS_FR[hundred]} cent${rest === 0 ? "s" : ""}`;
  return rest === 0 ? head : `${head} ${belowHundred(rest)}`;
}

/** Somme en lettres, à la française : 125 300 → « cent vingt-cinq mille trois cents ». */
export function amountInWords(amount: number): string {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const scales: [number, string, string][] = [
    [1_000_000_000, "milliard", "milliards"],
    [1_000_000, "million", "millions"],
  ];
  for (const [value, one, many] of scales) {
    const count = Math.floor(n / value);
    if (count > 0) {
      parts.push(`${amountInWords(count)} ${count > 1 ? many : one}`);
      n %= value;
    }
  }
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    // « mille » est invariable, et « cents » / « quatre-vingts » perdent leur s devant lui
    parts.push(thousands === 1 ? "mille" : `${belowThousand(thousands).replace(/(cent|vingt)s$/, "$1")} mille`);
    n %= 1000;
  }
  if (n > 0) parts.push(belowThousand(n));
  return parts.join(" ");
}

/** « Arrêtée la présente facture à la somme de cent mille (100 000) francs CFA. » */
export function amountSentence(type: DocumentType | "recu", amount: number, formatted: string): string {
  const what = type === "facture" ? "la présente facture" : type === "devis" ? "le présent devis" : "le présent reçu";
  const verb = type === "facture" ? "Arrêtée" : "Arrêté";
  const words = amountInWords(amount);
  return `${verb} ${what} à la somme de ${words.charAt(0).toUpperCase()}${words.slice(1)} (${formatted}) francs CFA.`;
}

export const UNITS = [
  { id: "piece", name: "Pièce", singular: "pièce", plural: "pièces", decimals: false },
  { id: "kg", name: "Kilogramme (kg)", singular: "kg", plural: "kg", decimals: true },
  { id: "g", name: "Gramme (g)", singular: "g", plural: "g", decimals: true },
  { id: "m", name: "Mètre (m)", singular: "m", plural: "m", decimals: true },
  { id: "l", name: "Litre (L)", singular: "litre", plural: "litres", decimals: true },
  { id: "sac", name: "Sac", singular: "sac", plural: "sacs", decimals: false },
  { id: "carton", name: "Carton", singular: "carton", plural: "cartons", decimals: false },
  { id: "paquet", name: "Paquet", singular: "paquet", plural: "paquets", decimals: false },
  { id: "boite", name: "Boîte", singular: "boîte", plural: "boîtes", decimals: false },
  { id: "rouleau", name: "Rouleau", singular: "rouleau", plural: "rouleaux", decimals: false },
  { id: "sachet", name: "Sachet", singular: "sachet", plural: "sachets", decimals: false },
  { id: "bouteille", name: "Bouteille", singular: "bouteille", plural: "bouteilles", decimals: false },
  { id: "paire", name: "Paire", singular: "paire", plural: "paires", decimals: false },
  { id: "lot", name: "Lot", singular: "lot", plural: "lots", decimals: false },
] as const;

export type UnitId = (typeof UNITS)[number]["id"];

const unitById = new Map<string, (typeof UNITS)[number]>(UNITS.map((u) => [u.id, u]));

export function isUnitId(value: string): value is UnitId {
  return unitById.has(value);
}

export function unitAllowsDecimals(unit: string): boolean {
  return unitById.get(unit)?.decimals ?? false;
}

export function unitLabel(unit: string, quantity = 1): string {
  const u = unitById.get(unit);
  if (!u) return unit;
  return Math.abs(quantity) >= 2 ? u.plural : u.singular;
}

const fcfa = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const qtyFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });

export function formatFCFA(amount: number): string {
  const rounded = Math.round(amount);
  return `${fcfa.format(rounded === 0 ? 0 : rounded)} FCFA`;
}

/** Montant sans l'unité, pour les champs et les graphiques. */
export function formatNumber(value: number): string {
  return fcfa.format(Math.round(value));
}

/** Taille d'un fichier : « 512 o », « 290 Ko », « 1,4 Mo ». */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export function formatQty(quantity: number, unit?: string): string {
  const n = qtyFormat.format(quantity);
  return unit ? `${n} ${unitLabel(unit, quantity)}` : n;
}

const TZ = "Africa/Dakar";
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const shortDateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
});

export function formatDate(date: Date | string): string {
  return dateFormat.format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return dateTimeFormat.format(new Date(date)).replace(" ", " à ");
}

export function formatShortDate(date: Date | string): string {
  return shortDateFormat.format(new Date(date));
}

/** Normalise un numéro sénégalais au format +221XXXXXXXXX, ou null s'il est invalide. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("221")) digits = digits.slice(3);
  if (!/^[73]\d{8}$/.test(digits)) return null;
  return `+221${digits}`;
}

export function formatPhone(phone: string): string {
  const m = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+221 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

const SMALL_WORDS = new Set(["à", "a", "de", "du", "des", "la", "le", "les", "et", "en", "d'", "l'", "&"]);

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w, i) => i === 0 || (!SMALL_WORDS.has(w.toLowerCase()) && /\p{L}/u.test(w)));
  return meaningful
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

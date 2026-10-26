import { BRAND_COLORS, DEFAULT_BRAND, isBrandColor } from "./brand";

/** Couleurs d'une boutique (sa couleur choisie, sinon le vert Sama Stock). */
export function shopColors(color: string | null | undefined) {
  return BRAND_COLORS[isBrandColor(color) ? color : DEFAULT_BRAND];
}

/** Logo utilisable pour fabriquer une icône (PNG ou JPEG ; le générateur d'images ne lit pas le WebP). */
export function iconLogo(logo: string | null | undefined): string | null {
  return logo && /^data:image\/(png|jpe?g);base64,/.test(logo) ? logo : null;
}

/** Mots génériques retirés du nom court : « Quincaillerie Ndiaye » devient « Ndiaye ». */
const GENERIC_WORDS = new Set([
  "alimentation",
  "boutique",
  "chez",
  "commerce",
  "des",
  "du",
  "de",
  "et",
  "ets",
  "etablissements",
  "établissements",
  "la",
  "le",
  "les",
  "librairie",
  "magasin",
  "maison",
  "pharmacie",
  "quincaillerie",
  "&",
]);

/** Nom court sous l'icône de l'écran d'accueil (12 caractères environ). */
export function shortAppName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length <= 12) return clean;
  const words = clean.split(" ");
  const meaningful = words.filter((w) => !GENERIC_WORDS.has(w.toLowerCase()));
  const source = meaningful.length > 0 ? meaningful : words;
  let short = "";
  for (const w of source) {
    const next = short ? `${short} ${w}` : w;
    if (next.length > 12) break;
    short = next;
  }
  return short || `${source[0]!.slice(0, 11)}…`;
}

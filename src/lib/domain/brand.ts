/**
 * Couleurs de l'application d'un client (licences) : une palette de 2 ou 3 couleurs.
 * - principale : boutons, liens, grande carte de l'accueil, graphiques ;
 * - menu : menu latéral, barre du téléphone, fond de l'icône de l'application ;
 * - rappel (facultative) : page ouverte dans le menu.
 *
 * Valeur enregistrée (businesses.brand_color) : le nom d'une palette proposée (« bleu ») ou des couleurs libres
 * « #1d4ed8,#1e3a8a,#f59e0b ». Seuls des codes #rrggbb validés sont injectés dans la page, et chaque couleur est
 * corrigée pour garder un texte lisible (contraste ≥ 4,5:1), avec sa variante pour le mode sombre.
 */
export type Palette = { primary: string; menu: string; highlight: string | null };

export const BRAND_PALETTES = {
  vert: { label: "Vert & safran", primary: "#0b6e4f", menu: "#0a5c42", highlight: "#f59e0b" },
  bleu: { label: "Bleu & safran", primary: "#1d4ed8", menu: "#1e3a8a", highlight: "#f59e0b" },
  "bleu-or": { label: "Bleu marine & or", primary: "#1d4ed8", menu: "#172554", highlight: "#fbbf24" },
  ciel: { label: "Bleu ciel & marine", primary: "#0369a1", menu: "#0c4a6e", highlight: "#7dd3fc" },
  turquoise: { label: "Turquoise & corail", primary: "#0f766e", menu: "#115e59", highlight: "#fb7185" },
  "vert-jaune": { label: "Vert & jaune", primary: "#15803d", menu: "#14532d", highlight: "#facc15" },
  "rouge-noir": { label: "Rouge & noir", primary: "#b91c1c", menu: "#171717", highlight: "#f87171" },
  bordeaux: { label: "Bordeaux & or", primary: "#9f1239", menu: "#881337", highlight: "#fbbf24" },
  rose: { label: "Rose & prune", primary: "#be185d", menu: "#500724", highlight: "#f9a8d4" },
  violet: { label: "Violet & rose", primary: "#6d28d9", menu: "#4c1d95", highlight: "#f472b6" },
  orange: { label: "Orange brûlé", primary: "#c2410c", menu: "#9a3412", highlight: "#fde68a" },
  "orange-bleu": { label: "Orange & bleu nuit", primary: "#c2410c", menu: "#1e293b", highlight: "#fdba74" },
  marron: { label: "Marron & crème", primary: "#92400e", menu: "#451a03", highlight: "#fde68a" },
  "noir-or": { label: "Noir & or", primary: "#262626", menu: "#0a0a0a", highlight: "#eab308" },
  ardoise: { label: "Ardoise & jaune", primary: "#334155", menu: "#1e293b", highlight: "#facc15" },
} as const satisfies Record<string, Palette & { label: string }>;

export type BrandPreset = keyof typeof BRAND_PALETTES;

export const DEFAULT_BRAND: BrandPreset = "vert";

const HEX = /^#[0-9a-f]{6}$/;
const CUSTOM = /^#[0-9a-f]{6},#[0-9a-f]{6}(,#[0-9a-f]{6})?$/;
const WHITE = "#ffffff";
const BLACK = "#000000";
/** Fond et surfaces du mode sombre (globals.css). */
const DARK_BACKGROUND = "#09100d";
const DARK_CARD = "#101714";
const DARK_SIDEBAR = "#0c1310";
const DARK_TEXT = "#1c1408";

export function isBrandPreset(value: unknown): value is BrandPreset {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BRAND_PALETTES, value);
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

/** Valeur propre à enregistrer (palette proposée ou couleurs libres), null si elle n'est pas valable. */
export function normalizeBrand(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/\s+/g, "");
  return isBrandPreset(v) || CUSTOM.test(v) ? v : null;
}

/** Couleurs libres → valeur enregistrée. */
export function customBrand(p: Palette): string {
  return [p.primary, p.menu, ...(p.highlight ? [p.highlight] : [])].map((c) => c.toLowerCase()).join(",");
}

/** Palette d'une valeur enregistrée ; null si elle n'est pas valable. */
export function parseBrand(value: unknown): Palette | null {
  const v = normalizeBrand(value);
  if (!v) return null;
  if (isBrandPreset(v)) {
    const { primary, menu, highlight } = BRAND_PALETTES[v];
    return { primary, menu, highlight };
  }
  const [primary, menu, highlight] = v.split(",");
  return { primary: primary!, menu: menu!, highlight: highlight ?? null };
}

/** Nom affiché d'une valeur : celui de la palette, sinon « Couleurs de la boutique ». */
export function brandLabel(value: unknown): string {
  const v = normalizeBrand(value);
  return v && isBrandPreset(v) ? BRAND_PALETTES[v].label : v ? "Couleurs de la boutique" : BRAND_PALETTES[DEFAULT_BRAND].label;
}

// ── Calculs de couleur (WCAG 2) ──

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Mélange : t = part de la deuxième couleur (0 à 1). */
export function mix(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return toHex([0, 1, 2].map((i) => ca[i]! + (cb[i]! - ca[i]!) * t) as [number, number, number]);
}

/** Assombrit (vers le noir) ou éclaircit (vers le blanc) jusqu'au contraste voulu avec le fond donné. */
function untilReadable(color: string, against: string, min: number, toward: string): string {
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const c = mix(color, toward, t);
    if (contrast(c, against) >= min) return c;
  }
  return toward;
}

/** Texte le plus lisible (presque noir ou blanc) sur une couleur. */
function textOn(color: string): string {
  return contrast(color, DARK_TEXT) >= contrast(color, WHITE) ? DARK_TEXT : WHITE;
}

/** Toutes les teintes de l'application, calculées à partir de la palette (vert Sama Stock à défaut). */
export function brandTheme(value: unknown) {
  const p = parseBrand(value) ?? parseBrand(DEFAULT_BRAND)!;
  const primary = untilReadable(p.primary, WHITE, 4.5, BLACK);
  const sidebar = untilReadable(p.menu, WHITE, 4.5, BLACK);
  // Le menu est toujours foncé (texte blanc) : la couleur de rappel s'éclaircit au besoin pour s'y voir
  const highlight = untilReadable(p.highlight ?? mix(primary, WHITE, 0.55), sidebar, 3, WHITE);
  const accent = mix(primary, WHITE, 0.92);
  const dark = untilReadable(primary, DARK_CARD, 4.5, WHITE);
  const darkHighlight = p.highlight ? untilReadable(p.highlight, DARK_SIDEBAR, 4.5, WHITE) : dark;
  return {
    primary,
    sidebar,
    highlight,
    highlightForeground: textOn(highlight),
    accent,
    accentForeground: untilReadable(mix(primary, BLACK, 0.2), accent, 4.5, BLACK),
    dark,
    darkHighlight,
    darkHighlightForeground: textOn(darkHighlight),
    darkAccent: mix(dark, DARK_BACKGROUND, 0.82),
    darkAccentForeground: mix(dark, WHITE, 0.75),
    /** Couleurs foncées automatiquement pour que le texte blanc reste lisible. */
    adjusted: primary !== p.primary || sidebar !== p.menu,
  };
}

export type BrandTheme = ReturnType<typeof brandTheme>;

/** Variables CSS qui recolorent l'application ; null pour la palette par défaut (rien à surcharger). */
export function brandCss(value: string | null | undefined): string | null {
  const v = normalizeBrand(value);
  if (!v || v === DEFAULT_BRAND) return null;
  const c = brandTheme(v);
  return [
    `:root{--primary:${c.primary};--ring:${c.primary};--sidebar:${c.sidebar};--sidebar-primary:${c.highlight};--sidebar-primary-foreground:${c.highlightForeground};--sidebar-ring:${c.highlight};--accent:${c.accent};--accent-foreground:${c.accentForeground};--chart-1:${c.primary}}`,
    // :root.dark l'emporte sur :root : sans cela, les teintes claires ci-dessus s'appliqueraient aussi en mode sombre
    `:root.dark{--primary:${c.dark};--ring:${c.dark};--sidebar:${DARK_SIDEBAR};--sidebar-primary:${c.darkHighlight};--sidebar-primary-foreground:${c.darkHighlightForeground};--sidebar-ring:${c.darkHighlight};--accent:${c.darkAccent};--accent-foreground:${c.darkAccentForeground};--chart-1:${c.dark}}`,
  ].join("");
}

/** Saturation (0 à 1) d'une couleur. */
function saturation(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}

/**
 * Couleurs dominantes d'une image (pixels RGBA d'un canvas), de la plus présente à la moins présente.
 * Le fond blanc, la transparence et les teintes trop rares (bords adoucis) sont ignorés.
 */
export function dominantColors(pixels: ArrayLike<number>, max = 3): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, pixels[i + 3]!];
    if (a < 128 || (r > 232 && g > 232 && b > 232)) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const box = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    box.n++;
    box.r += r;
    box.g += g;
    box.b += b;
    buckets.set(key, box);
    total++;
  }
  const picked: [number, number, number][] = [];
  for (const box of [...buckets.values()].filter((x) => x.n >= total * 0.02).sort((x, y) => y.n - x.n)) {
    const c: [number, number, number] = [box.r / box.n, box.g / box.n, box.b / box.n];
    if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) >= 64)) picked.push(c);
    if (picked.length === max) break;
  }
  return picked.map(toHex);
}

/**
 * Palette proposée à partir des couleurs d'un logo (de la plus présente à la moins présente) :
 * la couleur vive la plus présente devient la principale, une couleur plus foncée le menu, et une autre le rappel.
 */
export function suggestPalette(colors: string[]): Palette | null {
  const list = colors.filter(isHexColor);
  if (list.length === 0) return null;
  const vivid = list.filter((c) => saturation(c) >= 0.25 && luminance(c) > 0.02);
  const primary = vivid[0] ?? list[0]!;
  const others = list.filter((c) => c !== primary);
  const darker = others.filter((c) => luminance(c) < luminance(primary)).sort((a, b) => luminance(a) - luminance(b))[0];
  const menu = darker ?? mix(primary, BLACK, 0.3);
  const highlight = others.find((c) => c !== menu) ?? null;
  return { primary, menu, highlight };
}

/**
 * Couleurs proposées pour personnaliser l'application d'un client (licences).
 * Liste fermée : chaque couleur garde un texte blanc lisible (contraste ≥ 4,5:1) et a sa variante
 * pour le mode sombre. Aucune couleur libre n'est injectée dans la page.
 */
export const BRAND_COLORS = {
  vert: { label: "Vert Sama Stock", primary: "#0b6e4f", sidebar: "#0a5c42", accent: "#ecf4ef", accentForeground: "#0a4d38", dark: "#27a87c", darkAccent: "#17251f", darkAccentForeground: "#cdeadc" },
  bleu: { label: "Bleu nuit", primary: "#1d4ed8", sidebar: "#1e3a8a", accent: "#eef2ff", accentForeground: "#1e3a8a", dark: "#60a5fa", darkAccent: "#172036", darkAccentForeground: "#dbe6ff" },
  turquoise: { label: "Turquoise", primary: "#0f766e", sidebar: "#115e59", accent: "#f0fdfa", accentForeground: "#115e59", dark: "#2dd4bf", darkAccent: "#112b28", darkAccentForeground: "#ccfbf1" },
  violet: { label: "Violet", primary: "#6d28d9", sidebar: "#4c1d95", accent: "#f5f3ff", accentForeground: "#4c1d95", dark: "#a78bfa", darkAccent: "#221a38", darkAccentForeground: "#ede9fe" },
  bordeaux: { label: "Bordeaux", primary: "#9f1239", sidebar: "#881337", accent: "#fff1f2", accentForeground: "#881337", dark: "#fb7185", darkAccent: "#331822", darkAccentForeground: "#ffe4e6" },
  orange: { label: "Orange brûlé", primary: "#c2410c", sidebar: "#9a3412", accent: "#fff7ed", accentForeground: "#9a3412", dark: "#fb923c", darkAccent: "#33200f", darkAccentForeground: "#ffedd5" },
  ardoise: { label: "Ardoise", primary: "#334155", sidebar: "#1e293b", accent: "#f1f5f9", accentForeground: "#1e293b", dark: "#94a3b8", darkAccent: "#1e2530", darkAccentForeground: "#e2e8f0" },
} as const;

export type BrandColor = keyof typeof BRAND_COLORS;

export const DEFAULT_BRAND: BrandColor = "vert";

export function isBrandColor(value: unknown): value is BrandColor {
  return typeof value === "string" && value in BRAND_COLORS;
}

/** Variables CSS qui recolorent l'application ; null pour la couleur par défaut (rien à surcharger). */
export function brandCss(color: string | null | undefined): string | null {
  if (!isBrandColor(color) || color === DEFAULT_BRAND) return null;
  const c = BRAND_COLORS[color];
  return [
    `:root{--primary:${c.primary};--ring:${c.primary};--sidebar:${c.sidebar};--accent:${c.accent};--accent-foreground:${c.accentForeground};--chart-1:${c.primary}}`,
    // :root.dark l'emporte sur :root : sans cela, les teintes claires ci-dessus s'appliqueraient aussi en mode sombre
    `:root.dark{--primary:${c.dark};--ring:${c.dark};--sidebar:#0c1310;--sidebar-primary:${c.dark};--sidebar-ring:${c.dark};--accent:${c.darkAccent};--accent-foreground:${c.darkAccentForeground};--chart-1:${c.dark}}`,
  ].join("");
}

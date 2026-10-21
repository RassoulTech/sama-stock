/**
 * Identité légale publique de l'éditeur (loi sénégalaise n° 2008-08 sur les transactions électroniques).
 * Seules les informations exigées sont publiées : aucune donnée personnelle des pièces justificatives.
 */
export const LEGAL = {
  editor: "Dione Mouhamed, entreprise individuelle",
  director: "Dione Mouhamed",
  ninea: "013218369",
  rccm: "SN.THS.2026.A.4360",
  city: "Thiès, Sénégal",
  email: "digigeek221@gmail.com",
  /** Contact commercial et assistance (WhatsApp et appels). */
  phone: "+221 77 383 13 64",
  whatsapp: "221773831364",
  updatedAt: "19 octobre 2026",
} as const;

export const LEGAL_PAGES = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/conditions", label: "Conditions d'utilisation et de vente" },
] as const;

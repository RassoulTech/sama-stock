import type { NavItem } from "@/components/shell/nav";

/** Menu de l'espace d'administration (groupes : pilotage, gestion, sécurité). */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", short: "Accueil", icon: "dashboard", group: "main" },
  { href: "/admin/commerces", label: "Commerces", icon: "store", group: "manage" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "users", group: "manage" },
  { href: "/admin/abonnements", label: "Abonnements", icon: "billing", group: "manage" },
  { href: "/admin/paiements", label: "Paiements", icon: "payments", group: "manage" },
  { href: "/admin/connexions", label: "Connexions", icon: "sessions", group: "admin" },
  { href: "/admin/journal", label: "Journal des actions", short: "Journal", icon: "history", group: "admin" },
];

export const ADMIN_NAV_LABELS = { main: "Pilotage", manage: "Gestion", admin: "Sécurité" };

/** Les 4 rubriques de la barre du bas sur téléphone (le reste est dans « Menu »). */
export const ADMIN_BOTTOM_NAV = ["/admin", "/admin/commerces", "/admin/abonnements", "/admin/paiements"];

/** Petit compteur à côté d'une rubrique : « alert » attire l'œil (quelque chose à traiter). */
export type NavBadges = Partial<Record<string, { value: number; tone: "alert" | "muted" }>>;

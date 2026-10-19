import type { NavItem } from "@/components/shell/nav";

/** Menu de l'espace d'administration (groupes : pilotage, gestion, sécurité). */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", short: "Accueil", icon: "dashboard", group: "main" },
  { href: "/admin/commerces", label: "Commerces", icon: "store", group: "manage" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "users", group: "manage" },
  { href: "/admin/abonnements", label: "Abonnements", icon: "billing", group: "manage" },
  { href: "/admin/paiements", label: "Paiements", icon: "payments", group: "manage" },
  { href: "/admin/connexions", label: "Connexions", icon: "sessions", group: "admin" },
];

export const ADMIN_NAV_LABELS = { main: "Pilotage", manage: "Gestion", admin: "Sécurité" };

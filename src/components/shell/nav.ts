import type { Permission } from "@/lib/domain/permissions";

export type NavIcon =
  | "dashboard"
  | "pos"
  | "sales"
  | "orders"
  | "products"
  | "categories"
  | "stock"
  | "customers"
  | "suppliers"
  | "reports"
  | "team"
  | "billing"
  | "settings"
  | "admin"
  | "store"
  | "users"
  | "payments"
  | "sessions"
  | "system";

/** Sections du menu, dans l'ordre d'affichage. « main » sert à l'espace d'administration. */
export const NAV_GROUPS = ["main", "daily", "catalog", "contacts", "insights", "manage", "admin"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export const NAV_GROUP_LABELS: Record<NavGroup, string | null> = {
  main: null,
  daily: "Au quotidien",
  catalog: "Catalogue",
  contacts: "Contacts",
  insights: "Pilotage",
  manage: "Gestion",
  admin: "Sama Stock",
};

export interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: NavIcon;
  group: NavGroup;
}

interface NavRule extends NavItem {
  permission?: Permission;
  anyOf?: Permission[];
  module?: "pos" | "orders";
}

const RULES: NavRule[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord", short: "Accueil", icon: "dashboard", group: "daily" },
  { href: "/vendre", label: "Vendre", icon: "pos", group: "daily", permission: "sales.create", module: "pos" },
  { href: "/ventes", label: "Ventes", icon: "sales", group: "daily", permission: "sales.create", module: "pos" },
  { href: "/commandes", label: "Commandes", icon: "orders", group: "daily", permission: "orders.manage", module: "orders" },
  { href: "/produits", label: "Produits", icon: "products", group: "catalog", permission: "products.view" },
  { href: "/categories", label: "Catégories", icon: "categories", group: "catalog", permission: "products.view" },
  { href: "/stock", label: "Stock", icon: "stock", group: "catalog", anyOf: ["stock.in", "stock.adjust"] },
  { href: "/clients", label: "Clients et crédits", short: "Clients", icon: "customers", group: "contacts", permission: "customers.manage" },
  { href: "/fournisseurs", label: "Fournisseurs", icon: "suppliers", group: "contacts", permission: "suppliers.view" },
  { href: "/rapports", label: "Rapports", icon: "reports", group: "insights", permission: "reports.view" },
  { href: "/equipe", label: "Équipe", icon: "team", group: "manage", permission: "team.manage" },
  { href: "/abonnement", label: "Abonnement", icon: "billing", group: "manage", permission: "billing.manage" },
  { href: "/parametres", label: "Paramètres", icon: "settings", group: "manage", permission: "settings.manage" },
];

export function buildNav(opts: {
  can: (p: Permission) => boolean;
  modules: { pos: boolean; orders: boolean };
  isSuperAdmin: boolean;
}): NavItem[] {
  const items: NavItem[] = RULES.filter((r) => {
    if (r.permission && !opts.can(r.permission)) return false;
    if (r.anyOf && !r.anyOf.some((p) => opts.can(p))) return false;
    if (r.module && !opts.modules[r.module]) return false;
    return true;
  }).map(({ href, label, short, icon, group }) => ({ href, label, short, icon, group }));
  if (opts.isSuperAdmin) items.push({ href: "/admin", label: "Administration", icon: "admin", group: "admin" });
  return items;
}

/** Les 4 raccourcis de la barre du bas sur mobile (le reste est dans « Plus »). */
export function bottomNavItems(items: NavItem[]): NavItem[] {
  const order = ["/tableau-de-bord", "/vendre", "/commandes", "/produits", "/stock", "/clients"];
  return order
    .map((href) => items.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 4);
}

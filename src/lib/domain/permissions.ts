export const ROLES = ["owner", "manager", "seller", "storekeeper"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Propriétaire",
  manager: "Gérant",
  seller: "Vendeur",
  storekeeper: "Magasinier",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Voit et fait tout, y compris la licence et l'équipe.",
  manager: "Tout, sauf la licence, l'équipe et les paramètres du commerce.",
  seller: "Vend, gère les commandes et les clients. Ne voit ni les prix d'achat ni les bénéfices.",
  storekeeper: "Entrées, sorties, inventaire et transferts de stock, en quantités seulement.",
};

/** Rôles qu'un propriétaire peut attribuer à un employé. */
export const INVITABLE_ROLES = ["manager", "seller", "storekeeper"] as const satisfies readonly Role[];

export type Permission =
  | "dashboard.full"
  | "sales.create"
  | "sales.cancel"
  | "sales.delete"
  | "orders.manage"
  | "products.view"
  | "products.manage"
  | "stock.in"
  | "stock.adjust"
  | "stock.transfer"
  | "stock.cancel"
  | "customers.manage"
  | "payments.cancel"
  | "suppliers.view"
  | "suppliers.manage"
  | "costs.view"
  | "reports.view"
  | "team.manage"
  | "billing.manage"
  | "settings.manage";

const MANAGER: Permission[] = [
  "dashboard.full",
  "sales.create",
  "sales.cancel",
  "orders.manage",
  "products.view",
  "products.manage",
  "stock.in",
  "stock.adjust",
  "stock.transfer",
  "stock.cancel",
  "customers.manage",
  "payments.cancel",
  "suppliers.view",
  "suppliers.manage",
  "costs.view",
  "reports.view",
];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set<Permission>([...MANAGER, "sales.delete", "team.manage", "billing.manage", "settings.manage"]),
  manager: new Set(MANAGER),
  seller: new Set<Permission>(["sales.create", "orders.manage", "products.view", "customers.manage"]),
  storekeeper: new Set<Permission>(["products.view", "stock.in", "stock.adjust", "stock.transfer", "suppliers.view"]),
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

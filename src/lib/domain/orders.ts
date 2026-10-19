export const ORDER_STATUSES = ["new", "preparing", "shipping", "delivered", "cancelled", "returned"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nouvelle",
  preparing: "En préparation",
  shipping: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
  returned: "Retournée",
};

/** Libellé du bouton qui fait passer la commande à ce statut. */
export const ORDER_ACTION_LABELS: Record<OrderStatus, string> = {
  new: "Nouvelle",
  preparing: "Passer en préparation",
  shipping: "Envoyer en livraison",
  delivered: "Marquer livrée",
  cancelled: "Annuler la commande",
  returned: "Marquer retournée",
};

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["preparing", "shipping", "cancelled"],
  preparing: ["shipping", "cancelled"],
  shipping: ["delivered", "returned"],
  delivered: [],
  cancelled: [],
  returned: [],
};

/** Statuts pendant lesquels les produits sont réservés (encore physiquement en stock). */
export const RESERVING_STATUSES = ["new", "preparing"] as const satisfies readonly OrderStatus[];

/** Statuts « ouverts » : comptés comme commandes en cours. */
export const OPEN_STATUSES = ["new", "preparing", "shipping"] as const satisfies readonly OrderStatus[];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Effet d'un changement de statut sur le stock physique. */
export function orderStockEffect(from: OrderStatus, to: OrderStatus): "none" | "out" | "in" {
  if (to === "shipping" && (RESERVING_STATUSES as readonly string[]).includes(from)) return "out";
  if (from === "shipping" && to === "returned") return "in";
  return "none";
}

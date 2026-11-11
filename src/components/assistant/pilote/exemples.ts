// src/components/assistant/pilote/exemples.ts
import type { Mission } from "@/lib/domain/assistant/mission";

const ligne = (productId: string, name: string, quantity: number, unitPrice: number | null) => ({
  productId,
  name,
  unit: "kg",
  quantity,
  unitPrice,
  lineTotal: unitPrice === null ? null : quantity * unitPrice,
  available: 40,
  short: false,
});

export const VENTE_WAVE: Mission = {
  type: "tache",
  tache: {
    action: "sale",
    lines: [ligne("p1", "Riz parfumé 1kg", 2, 550)],
    total: 1100,
    paymentMethod: "wave",
    amountReceived: 1100,
    customer: { id: "c1", name: "Awa Ndiaye" },
    payload: { items: [{ productId: "p1", quantity: 2, unitPrice: 550 }], paymentMethod: "wave", customerId: "c1", amountReceived: 1100 },
  },
};
export const VENTE_CREDIT: Mission = {
  type: "tache",
  tache: {
    action: "sale",
    lines: [ligne("p2", "Riz brisé", 1, 400)],
    total: 400,
    paymentMethod: "credit",
    amountReceived: 0,
    customer: { id: "c1", name: "Awa Ndiaye" },
    payload: { items: [{ productId: "p2", quantity: 1 }], paymentMethod: "credit", customerId: "c1", amountReceived: 0 },
  },
};
export const ENTREE: Mission = {
  type: "tache",
  tache: {
    action: "purchase",
    lines: [ligne("p1", "Riz parfumé 1kg", 10, 450)],
    total: 4500,
    supplier: { id: "s1", name: "Sedima" },
    payload: { items: [{ productId: "p1", quantity: 10, unitCost: 450 }], supplierId: "s1" },
  },
};
export const SORTIE: Mission = {
  type: "tache",
  tache: { action: "stock_exit", product: { id: "p3", name: "Huile Dinor 1L", unit: "l", available: 5 }, quantity: 1, kind: "loss", reason: "breakage", reasonLabel: "Casse", note: "" },
};
export const COMMANDE: Mission = {
  type: "tache",
  tache: {
    action: "order",
    lines: [ligne("p1", "Riz parfumé 1kg", 3, 600)],
    total: 2800,
    deliveryFee: 1000,
    channel: "whatsapp",
    customer: { id: "c1", name: "Awa Ndiaye" },
    payload: { customerId: "c1", channel: "whatsapp", items: [{ productId: "p1", quantity: 3 }], deliveryFee: 1000, deliveryAddress: "Parcelles U17", amountPaid: 1000, paymentMethod: "wave" },
  },
};
export const STATUT: Mission = {
  type: "tache",
  tache: { action: "order_status", order: { id: "o1", number: "CMD-0012", customerName: "Awa Ndiaye" }, from: "shipping", to: "delivered", label: "Marquer livrée" },
};
export const PAIEMENT: Mission = {
  type: "tache",
  tache: { action: "payment", amount: 5000, method: "cash", customer: { id: "c1", name: "Awa Ndiaye" }, payload: { customerId: "c1", amount: 5000, method: "cash" } },
};
export const PRODUIT: Mission = {
  type: "tache",
  tache: { action: "product", name: "Savon Madar", unit: "piece", salePrice: 250, costPrice: 180, category: { id: null, name: "Hygiène" }, initialStock: 24, reference: "" },
};
export const PRIX: Mission = { type: "tache", tache: { action: "price", product: { id: "p3", name: "Huile Dinor 1L" }, oldSalePrice: 1300, salePrice: 1400, costPrice: null } };
export const CLIENT: Mission = { type: "tache", tache: { action: "customer", name: "Fatou Sall", phone: "771234567", address: "" } };
export const FOURNISSEUR: Mission = { type: "tache", tache: { action: "supplier", name: "Senico", phone: "", note: "livre le lundi" } };

const ecran = (e: Extract<Mission, { type: "ecran" }>["ecran"]): Mission => ({ type: "ecran", ecran: e });

export const MISSIONS_EXEMPLES: Mission[] = [
  VENTE_WAVE,
  VENTE_CREDIT,
  ENTREE,
  SORTIE,
  COMMANDE,
  STATUT,
  PAIEMENT,
  PRODUIT,
  PRIX,
  CLIENT,
  FOURNISSEUR,
  ecran({ ecran: "tableau_de_bord", url: "/tableau-de-bord", cible: "tdb.chiffre", titre: "Tableau de bord" }),
  ecran({ ecran: "rapports", url: "/rapports?periode=mois", cible: "rapports.chiffre", titre: "Rapports" }),
  ecran({ ecran: "ventes", url: "/ventes?periode=today", cible: "ventes.total", titre: "Ventes" }),
  ecran({ ecran: "stock_bas", url: "/produits?etat=bas", cible: "produits.liste", titre: "Stock bas" }),
  ecran({ ecran: "commandes", url: "/commandes", cible: "commandes.liste", titre: "Commandes" }),
  ecran({ ecran: "client", url: "/clients/c1", cible: "client.solde", titre: "Awa Ndiaye" }),
  ecran({ ecran: "produit", url: "/produits/p1", cible: "produit.stock", titre: "Riz parfumé 1kg" }),
];

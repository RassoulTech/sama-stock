import "server-only";
import type { DraftCatalog } from "@/lib/domain/assistant/drafts";
import { findByName } from "@/lib/domain/assistant/match";
import { PERIODS, periodRange, type Period, type ReadToolName } from "@/lib/domain/assistant/tools";
import type { BusinessContext } from "../context";
import { salesSummary } from "../queries/analytics";
import { listCustomers } from "../queries/customers";
import { listOrders } from "../queries/orders";
import type { ProductRow } from "../queries/products";
import { listSuppliers } from "../queries/stock";

/**
 * Outils de lecture : ils réutilisent les requêtes des pages.
 * Ils ne renvoient ni identifiant, ni téléphone, ni prix d'achat.
 */
export function createReaders(ctx: BusinessContext, products: ProductRow[]) {
  return async function read(name: ReadToolName, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (name) {
      case "stock_produit": {
        const match = findByName(String(args.produit ?? ""), products);
        if (match.kind === "none") return { trouve: false, message: "Produit introuvable dans le catalogue." };
        if (match.kind === "many") return { trouve: false, candidats: match.items.map((p) => p.name) };
        const p = match.item;
        return { trouve: true, produit: p.name, unite: p.unit, disponible: p.available, prix_vente: p.salePrice, statut: p.status };
      }
      case "resume_ventes": {
        const period: Period = (PERIODS as readonly string[]).includes(String(args.periode)) ? (args.periode as Period) : "aujourdhui";
        const { from, to } = periodRange(period);
        const full = ctx.can("dashboard.full");
        const s = await salesSummary(ctx, from, { own: !full, to });
        return {
          periode: period,
          seulement_mes_ventes: !full,
          chiffre_affaires: s.revenue,
          nombre_ventes: s.count,
          ...(full && ctx.can("costs.view") ? { benefice: s.profit } : {}),
        };
      }
      case "clients_debiteurs": {
        const debtors = (await listCustomers(ctx.business.id)).filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt);
        return {
          total_du: debtors.reduce((s, c) => s + c.debt, 0),
          nombre: debtors.length,
          clients: debtors.slice(0, 10).map((c) => ({ nom: c.name, doit: c.debt })),
        };
      }
      case "commandes_en_cours": {
        const orders = await listOrders(ctx, "open", {}, { limit: 10, offset: 0 });
        return {
          commandes: orders.map((o) => ({
            numero: o.number,
            statut: o.status,
            client: o.customerName,
            total: o.total,
            reste_a_payer: o.total - o.amountPaid,
          })),
        };
      }
    }
  };
}

/** Catalogue servant à vérifier les brouillons. Il reste sur le serveur : les téléphones servent seulement à retrouver un client. */
export async function loadDraftCatalog(ctx: BusinessContext, products: ProductRow[]): Promise<DraftCatalog> {
  const [customers, suppliers] = await Promise.all([listCustomers(ctx.business.id), listSuppliers(ctx.business.id)]);
  const costs = ctx.can("costs.view");
  return {
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      salePrice: p.salePrice,
      costPrice: costs ? p.costPrice : null,
      available: p.available,
    })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone })),
  };
}

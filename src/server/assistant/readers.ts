import "server-only";
import { resumeCatalogue } from "@/lib/domain/assistant/catalogue";
import type { DraftCatalog } from "@/lib/domain/assistant/drafts";
import { findByName } from "@/lib/domain/assistant/match";
import { isOrderStatus } from "@/lib/domain/orders";
import { intervalle, PERIODES, type Periode } from "@/lib/domain/assistant/periodes";
import type { ReadToolName } from "@/lib/domain/assistant/tools";
import { CHANNELS, PAYMENT_METHODS } from "@/lib/domain/sales";
import { REASON_LABELS } from "@/lib/domain/stock";
import type { BusinessContext } from "../context";
import { breakdown, categoryBreakdown, dormantProducts, losses, salesSummary, topProducts } from "../queries/analytics";
import { listCustomers } from "../queries/customers";
import { listOrders } from "../queries/orders";
import { listCategories, type ProductRow } from "../queries/products";
import { listSuppliers } from "../queries/stock";

/**
 * Outils de lecture : ils réutilisent les requêtes des pages.
 * Ils ne renvoient ni identifiant, ni téléphone, ni prix d'achat.
 */
export function createReaders(ctx: BusinessContext, products: ProductRow[]) {
  return async function read(name: ReadToolName, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (name) {
      case "resume_catalogue":
        return resumeCatalogue(products.filter((p) => !p.archived), { costs: ctx.can("costs.view") });
      case "stock_produit": {
        const match = findByName(String(args.produit ?? ""), products);
        if (match.kind === "none") return { trouve: false, message: "Produit introuvable dans le catalogue." };
        if (match.kind === "many") return { trouve: false, candidats: match.items.map((p) => p.name) };
        const p = match.item;
        return { trouve: true, produit: p.name, unite: p.unit, disponible: p.available, prix_vente: p.salePrice, statut: p.status };
      }
      case "resume_ventes": {
        const p = periodeDemandee(args);
        const full = ctx.can("dashboard.full");
        const s = await salesSummary(ctx, p.from ?? new Date(0), { own: !full, to: p.to ?? undefined });
        return {
          periode: p.label,
          seulement_mes_ventes: !full,
          chiffre_affaires: s.revenue,
          nombre_ventes: s.count,
          ...(full && ctx.can("costs.view") ? { benefice: s.profit } : {}),
        };
      }
      case "analyse_ventes":
        return analyse(ctx, args);
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

const texteArg = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Période demandée par l'IA (mots de l'assistant, ou dates du / au), en dates pour les requêtes. */
function periodeDemandee(args: Record<string, unknown>, defaut: Periode = "aujourdhui") {
  const periode = (PERIODES as readonly string[]).includes(String(args.periode)) ? (args.periode as Periode) : defaut;
  return intervalle(periode, { du: texteArg(args.du), au: texteArg(args.au) });
}

/** Les chiffres des sections des rapports, pour les dire à voix haute sans les lire à l'écran. */
async function analyse(ctx: BusinessContext, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!ctx.plan.limits.advancedReports) return { ok: false, raison: "Les rapports avancés ne sont pas inclus dans l'offre de ce commerce." };
  const p = periodeDemandee(args, "30jours");
  const from = p.from ?? new Date(0);
  const to = p.to;
  const couts = ctx.can("costs.view");
  const base = { periode: p.label };
  switch (args.vue) {
    case "produits":
    case "produit":
    case "rentables": {
      const brut = await topProducts(ctx, from, 50, to);
      // Un identifiant pour la recherche par nom (une ligne sans produit garde son rang)
      const avecId = (rows: typeof brut.byRevenue) => rows.map((r, i) => ({ ...r, id: r.productId ?? `ligne-${i}` }));
      const top = { byRevenue: avecId(brut.byRevenue), byProfit: avecId(brut.byProfit) };
      const ligne = (r: (typeof top.byRevenue)[number]) => ({
        produit: r.name,
        quantite: r.quantity,
        unite: r.unit,
        chiffre_affaires: r.revenue,
        ...(couts ? { benefice: r.profit } : {}),
      });
      if (args.vue === "produit") {
        const nom = texteArg(args.produit) ?? "";
        const match = findByName(nom, top.byRevenue);
        if (match.kind === "many") return { ...base, trouve: false, candidats: match.items.map((r) => r.name) };
        if (match.kind === "none") return { ...base, trouve: false, message: `Aucune vente de « ${nom} » sur cette période.` };
        return { ...base, trouve: true, ...ligne(match.item), rang: top.byRevenue.indexOf(match.item) + 1 };
      }
      if (args.vue === "rentables") {
        if (!couts) return { ok: false, raison: "Ce rôle ne voit pas les bénéfices." };
        return { ...base, produits: top.byProfit.filter((r) => r.profit > 0).slice(0, 10).map(ligne) };
      }
      return { ...base, produits: top.byRevenue.slice(0, 10).map(ligne), classement: "par chiffre d'affaires" };
    }
    case "categories": {
      const rows = await categoryBreakdown(ctx, from, to);
      return {
        ...base,
        categories: rows.map((c) => ({
          categorie: c.name,
          chiffre_affaires: c.revenue,
          part_pourcent: c.share,
          nombre_ventes: c.saleCount,
          ...(couts ? { benefice: c.profit } : {}),
        })),
      };
    }
    case "canaux":
    case "paiements": {
      const rows = await breakdown(ctx, from, args.vue === "canaux" ? "channel" : "paymentMethod", to);
      const libelle = (k: string) =>
        args.vue === "canaux"
          ? ((CHANNELS as Record<string, string>)[k] ?? k)
          : k === "inconnu"
            ? "Non payé"
            : ((PAYMENT_METHODS as Record<string, string>)[k] ?? k);
      return { ...base, lignes: rows.map((r) => ({ nom: libelle(r.key), chiffre_affaires: r.revenue, nombre_ventes: r.count })) };
    }
    case "dormants": {
      const rows = await dormantProducts(ctx, 30);
      return {
        periode: "aucune vente depuis 30 jours",
        produits: rows.slice(0, 15).map((d) => ({ produit: d.name, quantite: d.quantity, unite: d.unit, derniere_vente: d.last_sale ?? "jamais" })),
      };
    }
    case "pertes": {
      const rows = await losses(ctx, from, to);
      return { ...base, pertes: rows.map((l) => ({ motif: REASON_LABELS[l.reason] ?? l.reason, fois: l.count, ...(couts ? { valeur: l.value } : {}) })) };
    }
    default:
      return { ok: false, raison: "Vue inconnue." };
  }
}

/** Catalogue servant à vérifier les brouillons et les écrans. Il reste sur le serveur. */
export async function loadDraftCatalog(ctx: BusinessContext, products: ProductRow[]): Promise<DraftCatalog> {
  const [customers, suppliers, categories, orders] = await Promise.all([
    listCustomers(ctx.business.id),
    listSuppliers(ctx.business.id),
    listCategories(ctx.business.id),
    ctx.can("orders.manage") ? listOrders(ctx, "open", {}, { limit: 50, offset: 0 }) : Promise.resolve([]),
  ]);
  const costs = ctx.can("costs.view");
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, unit: p.unit, salePrice: p.salePrice, costPrice: costs ? p.costPrice : null, available: p.available })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, debt: c.debt })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    openOrders: orders.flatMap((o) =>
      isOrderStatus(o.status) ? [{ id: o.id, number: String(o.number), customerName: o.customerName ?? "", status: o.status }] : [],
    ),
  };
}

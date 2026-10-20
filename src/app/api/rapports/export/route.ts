import { REASON_LABELS } from "@/lib/domain/stock";
import { CHANNELS, PAYMENT_METHODS, type Channel, type PaymentMethod } from "@/lib/domain/sales";
import { REPORT_PRESETS, resolvePeriod } from "@/lib/filters";
import { unitLabel } from "@/lib/format";
import { getContext, type BusinessContext } from "@/server/context";
import { addSheet, addTable, DATETIME_FORMAT, DAY_FORMAT, FCFA, fileSlug, newWorkbook, PERCENT, workbookResponse } from "@/server/excel";
import { breakdown, categoryBreakdown, dailySeries, losses, salesSummary, stockValue } from "@/server/queries/analytics";
import { EXPORT_LINE_LIMIT, productSales, saleLines } from "@/server/queries/exports";
import { listProducts } from "@/server/queries/products";

/** Export Excel des rapports sur la période choisie (formules Pro et Business). */
export async function GET(request: Request) {
  const ctx = await getContext();
  if (!ctx?.business) return new Response("Connectez-vous pour exporter vos rapports.", { status: 401 });
  const bctx = ctx as BusinessContext;
  if (bctx.plan.status === "suspended" || !bctx.can("reports.view")) return new Response("Accès refusé.", { status: 403 });
  if (!bctx.plan.limits.excel) {
    return new Response("L'export Excel est inclus dans les formules Pro et Business.", { status: 403 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const period = resolvePeriod(params, { fallback: "30j", allowed: REPORT_PRESETS });
  const from = period.from!;
  const to = period.to!;
  const lastDay = new Date(to.getTime() - 86_400_000);

  const [summary, series, cats, prods, lines, channels, methods, lossRows, stock, value] = await Promise.all([
    salesSummary(bctx, from, { to }),
    dailySeries(bctx, from, period.days ?? 30),
    categoryBreakdown(bctx, from, to),
    productSales(bctx, from, to),
    saleLines(bctx, from, to),
    breakdown(bctx, from, "channel", to),
    breakdown(bctx, from, "paymentMethod", to),
    losses(bctx, from, to),
    listProducts(bctx),
    bctx.can("costs.view") ? stockValue(bctx) : Promise.resolve(null),
  ]);
  const showCost = bctx.can("costs.view");
  const lossTotal = lossRows.reduce((s, l) => s + l.value, 0);
  const pct = (part: number, total: number) => (total > 0 ? part / total : 0);

  const wb = newWorkbook();

  // 1. Résumé
  const resume: unknown[][] = [
    ["Rapport Sama Stock"],
    [],
    ["Commerce", bctx.business.name],
    ["Période", period.label],
    ["Du", from],
    ["Au", lastDay],
    ["Exporté le", new Date()],
    [],
    ["Chiffre d'affaires (FCFA)", summary.revenue],
    ["Bénéfice brut (FCFA)", summary.profit],
    ["Marge moyenne", pct(summary.profit, summary.revenue)],
    ["Ventes et commandes livrées", summary.count],
    ["Pertes (FCFA)", lossTotal],
    ...(value !== null ? [["Valeur du stock actuel (FCFA)", value]] : []),
    [],
    ["Chiffres hors frais de livraison : ventes validées et commandes livrées."],
  ];
  addSheet(wb, "Résumé", resume, [34, 28], [
    [4, 1, DAY_FORMAT],
    [5, 1, DAY_FORMAT],
    [6, 1, DATETIME_FORMAT],
    [8, 1, FCFA],
    [9, 1, FCFA],
    [10, 1, PERCENT],
    [12, 1, FCFA],
    [13, 1, FCFA],
  ]);

  // 2. Ventes par jour
  addTable(
    wb,
    "Ventes par jour",
    [
      { header: "Date", width: 12, format: DAY_FORMAT },
      { header: "Chiffre d'affaires", width: 18, format: FCFA },
      { header: "Bénéfice", width: 14, format: FCFA },
    ],
    series.map((d) => [new Date(`${d.day}T00:00:00Z`), d.revenue, d.profit]),
  );

  // 3. Par catégorie
  addTable(
    wb,
    "Par catégorie",
    [
      { header: "Catégorie", width: 26 },
      { header: "Chiffre d'affaires", width: 18, format: FCFA },
      { header: "Part du total", width: 14, format: PERCENT },
      { header: "Bénéfice", width: 14, format: FCFA },
      { header: "Marge", width: 10, format: PERCENT },
      { header: "Ventes", width: 10 },
      { header: "Quantité vendue", width: 16 },
    ],
    cats.map((c) => [c.name, c.revenue, c.share / 100, c.profit, pct(c.profit, c.revenue), c.saleCount, c.quantity]),
  );

  // 4. Par produit
  addTable(
    wb,
    "Par produit",
    [
      { header: "Produit", width: 32 },
      { header: "Catégorie", width: 20 },
      { header: "Quantité vendue", width: 16 },
      { header: "Unité", width: 10 },
      { header: "Chiffre d'affaires", width: 18, format: FCFA },
      { header: "Bénéfice", width: 14, format: FCFA },
      { header: "Marge", width: 10, format: PERCENT },
    ],
    prods.map((p) => [p.name, p.category ?? "Sans catégorie", p.quantity, unitLabel(p.unit, p.quantity), p.revenue, p.profit, pct(p.profit, p.revenue)]),
  );

  // 5. Détail des ventes, ligne par ligne
  addTable(
    wb,
    "Détail des ventes",
    [
      { header: "Date", width: 17, format: DATETIME_FORMAT },
      { header: "N°", width: 9 },
      { header: "Type", width: 10 },
      { header: "Canal", width: 12 },
      { header: "Boutique", width: 18 },
      { header: "Client", width: 22 },
      { header: "Vendeur", width: 18 },
      { header: "Produit", width: 30 },
      { header: "Catégorie", width: 18 },
      { header: "Quantité", width: 10 },
      { header: "Unité", width: 10 },
      { header: "Prix unitaire", width: 13, format: FCFA },
      { header: "Total", width: 13, format: FCFA },
      ...(showCost ? [{ header: "Coût", width: 12, format: FCFA }, { header: "Bénéfice", width: 12, format: FCFA }] : []),
      { header: "Paiement", width: 14 },
    ],
    lines.map((l) => {
      const qty = Number(l.quantity);
      const cost = Math.round(l.unitCost * qty);
      return [
        l.completedAt,
        l.number,
        l.kind === "order" ? "Commande" : "Vente",
        CHANNELS[l.channel as Channel] ?? l.channel,
        l.locationName,
        l.customerName ?? "",
        l.sellerName ?? "",
        l.product,
        l.category ?? "Sans catégorie",
        qty,
        unitLabel(l.unit, qty),
        l.unitPrice,
        l.lineTotal,
        ...(showCost ? [cost, l.lineTotal - cost] : []),
        l.paymentMethod ? (PAYMENT_METHODS[l.paymentMethod as PaymentMethod] ?? l.paymentMethod) : "Non payé",
      ];
    }),
  );

  // 6. Canaux et modes de paiement
  addTable(
    wb,
    "Canaux et paiements",
    [
      { header: "Regroupement", width: 14 },
      { header: "Valeur", width: 18 },
      { header: "Chiffre d'affaires", width: 18, format: FCFA },
      { header: "Nombre de ventes", width: 16 },
    ],
    [
      ...channels.map((c) => ["Canal", CHANNELS[c.key as Channel] ?? c.key, c.revenue, c.count]),
      ...methods.map((m) => ["Paiement", m.key === "inconnu" ? "Non payé" : (PAYMENT_METHODS[m.key as PaymentMethod] ?? m.key), m.revenue, m.count]),
    ],
  );

  // 7. Pertes
  addTable(
    wb,
    "Pertes",
    [
      { header: "Motif", width: 24 },
      { header: "Quantité", width: 12 },
      { header: "Valeur (prix d'achat)", width: 20, format: FCFA },
      { header: "Nombre", width: 10 },
    ],
    lossRows.map((l) => [REASON_LABELS[l.reason] ?? l.reason, l.quantity, l.value, l.count]),
  );

  // 8. Stock actuel de la boutique
  addTable(
    wb,
    `Stock ${bctx.location.name}`,
    [
      { header: "Produit", width: 32 },
      { header: "Référence", width: 14 },
      { header: "Catégorie", width: 20 },
      { header: "Unité", width: 10 },
      { header: "Disponible", width: 12 },
      { header: "En stock", width: 10 },
      { header: "Réservé", width: 10 },
      ...(showCost ? [{ header: "Prix d'achat", width: 13, format: FCFA }] : []),
      { header: "Prix de vente", width: 13, format: FCFA },
      ...(showCost ? [{ header: "Valeur du stock", width: 16, format: FCFA }] : []),
    ],
    stock.map((p) => [
      p.name,
      p.reference ?? "",
      p.categoryName ?? "Sans catégorie",
      unitLabel(p.unit, p.physical),
      p.available,
      p.physical,
      p.reserved,
      ...(showCost ? [p.costPrice ?? 0] : []),
      p.salePrice,
      ...(showCost ? [Math.round(Math.max(p.physical, 0) * (p.costPrice ?? 0))] : []),
    ]),
  );

  if (lines.length >= EXPORT_LINE_LIMIT) {
    addSheet(wb, "Remarque", [[`Seules les ${EXPORT_LINE_LIMIT} premières lignes de vente sont exportées : choisissez une période plus courte.`]], [100]);
  }

  const name = `rapport-sama-stock-${fileSlug(bctx.business.name)}-${from.toISOString().slice(0, 10)}-au-${lastDay.toISOString().slice(0, 10)}.xlsx`;
  return workbookResponse(wb, name);
}

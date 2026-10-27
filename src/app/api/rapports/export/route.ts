import { REPORT_PRESETS, resolvePeriod } from "@/lib/filters";
import { getContext, type BusinessContext } from "@/server/context";
import { fileSlug, workbookResponse } from "@/server/excel";
import { breakdown, categoryBreakdown, dailySeries, losses, salesSummary, stockValue } from "@/server/queries/analytics";
import { EXPORT_LINE_LIMIT, productSales, saleLines } from "@/server/queries/exports";
import { listProducts } from "@/server/queries/products";
import { buildSalesReport } from "@/server/reports/sales-report";

const DAY_MS = 86_400_000;

/** « du 21 septembre au 20 octobre 2026 », « le 20 octobre 2026 ». */
function periodText(from: Date, lastDay: Date) {
  const opts = { day: "numeric", month: "long", timeZone: "Africa/Dakar" } as const;
  const full = (d: Date) => d.toLocaleDateString("fr-FR", { ...opts, year: "numeric" });
  if (from.getTime() === lastDay.getTime()) return `le ${full(lastDay)}`;
  const sameYear = from.getUTCFullYear() === lastDay.getUTCFullYear();
  return `du ${sameYear ? from.toLocaleDateString("fr-FR", opts) : full(from)} au ${full(lastDay)}`;
}

/** Export Excel des rapports sur la période choisie (licences). */
export async function GET(request: Request) {
  const ctx = await getContext();
  if (!ctx?.business) return new Response("Connectez-vous pour exporter vos rapports.", { status: 401 });
  const bctx = ctx as BusinessContext;
  if (bctx.plan.status === "suspended" || !bctx.can("reports.view")) return new Response("Accès refusé.", { status: 403 });
  if (!bctx.plan.limits.excel) {
    return new Response("L'export Excel est inclus dans toutes les licences.", { status: 403 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const period = resolvePeriod(params, { fallback: "30j", allowed: REPORT_PRESETS });
  const from = period.from!;
  const to = period.to!;
  const lastDay = new Date(to.getTime() - DAY_MS);
  const showCost = bctx.can("costs.view");

  const [summary, series, categories, products, lines, channels, methods, lossRows, stock, value] = await Promise.all([
    salesSummary(bctx, from, { to }),
    dailySeries(bctx, from, period.days ?? 30),
    categoryBreakdown(bctx, from, to),
    productSales(bctx, from, to),
    saleLines(bctx, from, to),
    breakdown(bctx, from, "channel", to),
    breakdown(bctx, from, "paymentMethod", to),
    losses(bctx, from, to),
    listProducts(bctx),
    showCost ? stockValue(bctx) : Promise.resolve(null),
  ]);

  const wb = buildSalesReport({
    meta: { business: bctx.business.name, period: periodText(from, lastDay) },
    locationName: bctx.location.name,
    generatedAt: new Date(),
    showCost,
    summary,
    series,
    categories,
    products,
    lines,
    lineLimit: lines.length >= EXPORT_LINE_LIMIT ? EXPORT_LINE_LIMIT : null,
    channels,
    methods,
    losses: lossRows,
    stock,
    stockValue: value,
  });

  const name = `rapport-sama-stock-${fileSlug(bctx.business.name)}-${from.toISOString().slice(0, 10)}-au-${lastDay.toISOString().slice(0, 10)}.xlsx`;
  return workbookResponse(wb, name);
}

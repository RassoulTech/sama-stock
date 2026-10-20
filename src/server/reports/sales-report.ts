import "server-only";
import type ExcelJS from "exceljs";
import { CHANNELS, PAYMENT_METHODS, type Channel, type PaymentMethod } from "@/lib/domain/sales";
import { REASON_LABELS, type StockStatus } from "@/lib/domain/stock";
import { unitLabel } from "@/lib/format";
import {
  COLORS,
  FORMATS,
  font,
  newWorkbook,
  sectionTitle,
  sheetLink,
  solid,
  startSheet,
  textBar,
  writeTable,
  type Column,
  type ReportMeta,
} from "../excel";
import type { ProductRow } from "../queries/products";
import type { productSales, saleLines } from "../queries/exports";

export interface SalesReportData {
  meta: ReportMeta;
  locationName: string;
  generatedAt: Date;
  showCost: boolean;
  summary: { revenue: number; profit: number; count: number };
  series: { day: string; revenue: number; profit: number }[];
  categories: { name: string; revenue: number; profit: number; quantity: number; saleCount: number }[];
  products: Awaited<ReturnType<typeof productSales>>;
  lines: Awaited<ReturnType<typeof saleLines>>;
  /** Le détail a été coupé à `lineLimit` lignes. */
  lineLimit: number | null;
  channels: { key: string; revenue: number; count: number }[];
  methods: { key: string; revenue: number; count: number }[];
  losses: { reason: string; quantity: number; value: number; count: number }[];
  stock: ProductRow[];
  stockValue: number | null;
}

const SHEETS = {
  summary: "Résumé",
  days: "Ventes par jour",
  categories: "Par catégorie",
  products: "Par produit",
  lines: "Toutes les ventes",
  channels: "Lieux de vente et paiements",
  losses: "Pertes",
  stock: "Stock actuel",
} as const;

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const STATUS: Record<StockStatus, { label: string; fill: string; color: string }> = {
  out: { label: "Rupture", fill: COLORS.dangerSoft, color: COLORS.danger },
  low: { label: "Stock bas", fill: COLORS.saffronSoft, color: COLORS.warning },
  ok: { label: "En stock", fill: COLORS.accent, color: COLORS.primary },
};

/** Raisons de perte en mots simples (l'inventaire ne parle qu'aux initiés). */
const reasonLabel = (reason: string) => (reason === "inventory" ? "Manquant à l'inventaire" : (REASON_LABELS[reason] ?? reason));

const nf = new Intl.NumberFormat("fr-FR");
const fcfa = (n: number) => `${nf.format(Math.round(n))} FCFA`;
const pct = (part: number, total: number) => (total > 0 ? part / total : 0);
const longDate = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Dakar" });
const channelLabel = (key: string) => CHANNELS[key as Channel] ?? key;
/** « en boutique », « sur WhatsApp », « par téléphone »… */
const CHANNEL_PHRASES: Partial<Record<Channel, string>> = {
  boutique: "en boutique",
  site: "sur votre site web",
  telephone: "par téléphone",
  autre: "par d'autres moyens",
};
const channelPhrase = (key: string) => CHANNEL_PHRASES[key as Channel] ?? `sur ${channelLabel(key)}`;
const methodLabel = (key: string) => (key === "inconnu" ? "Non payé" : (PAYMENT_METHODS[key as PaymentMethod] ?? key));

/** Classeur Excel complet du rapport d'activité, mis en forme aux couleurs de Sama Stock. */
export function buildSalesReport(d: SalesReportData) {
  const wb = newWorkbook(`Rapport d'activité · ${d.meta.business}`);
  summarySheet(wb, d);
  daysSheet(wb, d);
  categoriesSheet(wb, d);
  productsSheet(wb, d);
  linesSheet(wb, d);
  channelsSheet(wb, d);
  lossesSheet(wb, d);
  stockSheet(wb, d);
  return wb;
}

// ── Résumé ──────────────────────────────────────────────────────────────────

/** Colonnes du résumé : marges étroites (A, D, G) et trois cartes de deux colonnes. */
const CARD_COLS = [2, 5, 8];
const LAST_COL = 9;

function card(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  c: { label: string; value: number; format: string; hint: string; tone?: "danger" | "warning" },
) {
  const border = { style: "thin", color: { argb: "FFD3E2D9" } } as const;
  const parts = [
    { value: c.label, font: font({ size: 10, bold: true, color: { argb: COLORS.muted } }), height: 20 },
    {
      value: c.value,
      font: font({ size: 20, bold: true, color: { argb: c.tone === "danger" ? COLORS.danger : c.tone === "warning" ? COLORS.warning : COLORS.primary } }),
      height: 32,
    },
    { value: c.hint, font: font({ size: 9, color: { argb: COLORS.muted } }), height: 30 },
  ];
  parts.forEach((p, i) => {
    const r = row + i;
    ws.mergeCells(r, col, r, col + 1);
    const cell = ws.getCell(r, col);
    cell.value = p.value;
    cell.font = p.font;
    cell.alignment = { vertical: i === 2 ? "top" : "middle", horizontal: "left", wrapText: i === 2, indent: 1 };
    if (i === 1) cell.numFmt = c.format;
    for (const cc of [col, col + 1]) {
      const x = ws.getCell(r, cc);
      x.fill = solid(COLORS.accent);
      x.border = {
        top: i === 0 ? border : undefined,
        bottom: i === 2 ? border : undefined,
        left: cc === col ? border : undefined,
        right: cc === col + 1 ? border : undefined,
      };
    }
    ws.getRow(r).height = Math.max(ws.getRow(r).height ?? 0, p.height);
  });
}

function sentence(ws: ExcelJS.Worksheet, row: number, text: string) {
  ws.mergeCells(row, 2, row, LAST_COL);
  const cell = ws.getCell(row, 2);
  cell.value = `•   ${text}`;
  cell.font = font({ size: 11 });
  cell.alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(row).height = text.length > 105 ? 32 : 20;
}

function summarySheet(wb: ExcelJS.Workbook, d: SalesReportData) {
  const ws = wb.addWorksheet(SHEETS.summary, {
    properties: { tabColor: { argb: COLORS.saffron } },
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  [2, 19, 19, 2, 19, 19, 2, 19, 19].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getRow(1).height = 10;

  // Bandeau
  const banner: [string, Partial<ExcelJS.Font>, number][] = [
    ["SAMA STOCK", font({ size: 10, bold: true, color: { argb: "FFF8C66B" } }), 22],
    ["Rapport d'activité", font({ size: 24, bold: true, color: { argb: COLORS.white } }), 38],
    [`${d.meta.business}  ·  ${d.meta.period}`, font({ size: 12, color: { argb: COLORS.white } }), 22],
    [
      `Créé le ${d.generatedAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar" })} à ${d.generatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" })}`,
      font({ size: 9.5, color: { argb: "FFB9DCCB" } }),
      24,
    ],
  ];
  banner.forEach(([text, f, h], i) => {
    const r = 2 + i;
    ws.mergeCells(r, 2, r, LAST_COL);
    const cell = ws.getCell(r, 2);
    cell.value = text;
    cell.font = f;
    cell.alignment = { vertical: i === 3 ? "top" : "middle", indent: 1 };
    for (let c = 2; c <= LAST_COL; c++) ws.getCell(r, c).fill = solid(COLORS.primary);
    ws.getRow(r).height = h;
  });

  // L'essentiel
  let row = 7;
  sectionTitle(ws, row, "L'essentiel de la période", LAST_COL - 1, 2);
  row += 2;
  const { revenue, profit, count } = d.summary;
  const lossTotal = d.losses.reduce((s, l) => s + l.value, 0);
  const cards = [
    { label: "Montant des ventes", value: revenue, format: FORMATS.money, hint: "Ce que vos clients ont payé (hors livraison)." },
    { label: "Bénéfice", value: profit, format: FORMATS.money, hint: "Ce qu'il vous reste après le prix d'achat des produits.", tone: profit < 0 ? ("danger" as const) : undefined },
    { label: "Marge", value: pct(profit, revenue), format: FORMATS.percent, hint: "Sur 100 FCFA vendus, la part qui est du bénéfice." },
    { label: "Nombre de ventes", value: count, format: FORMATS.number, hint: "Ventes en caisse et commandes livrées." },
    { label: "Montant moyen par vente", value: count > 0 ? Math.round(revenue / count) : 0, format: FORMATS.money, hint: "Ce qu'un client dépense en moyenne." },
    { label: "Pertes", value: lossTotal, format: FORMATS.money, hint: "Casse, vol, produits périmés… au prix d'achat.", tone: lossTotal > 0 ? ("danger" as const) : undefined },
  ];
  cards.forEach((c, i) => card(ws, row + Math.floor(i / 3) * 4, CARD_COLS[i % 3]!, c));
  row += 8;

  // Stock
  sectionTitle(ws, row, `Votre stock aujourd'hui · ${d.locationName}`, LAST_COL - 1, 2);
  row += 2;
  const low = d.stock.filter((p) => p.status === "low").length;
  const out = d.stock.filter((p) => p.status === "out").length;
  const stockCards = [
    d.stockValue !== null
      ? { label: "Valeur de votre stock", value: d.stockValue, format: FORMATS.money, hint: "Ce que votre stock vous a coûté (prix d'achat)." }
      : { label: "Produits suivis", value: d.stock.length, format: FORMATS.number, hint: "Produits actifs dans votre catalogue." },
    { label: "Produits en stock bas", value: low, format: FORMATS.number, hint: "À racheter bientôt.", tone: low > 0 ? ("warning" as const) : undefined },
    { label: "Produits en rupture", value: out, format: FORMATS.number, hint: "Plus aucune unité disponible.", tone: out > 0 ? ("danger" as const) : undefined },
  ];
  stockCards.forEach((c, i) => card(ws, row, CARD_COLS[i]!, c));
  row += 4;

  // À retenir
  sectionTitle(ws, row, "À retenir", LAST_COL - 1, 2);
  row += 1;
  for (const s of highlights(d, lossTotal, low + out)) sentence(ws, row++, s);
  row += 1;

  // Sommaire
  sectionTitle(ws, row, "Dans ce fichier", LAST_COL - 1, 2);
  row += 1;
  const toc: [string, string][] = [
    [SHEETS.days, "Vos ventes et votre bénéfice, jour par jour."],
    [SHEETS.categories, "Quelles familles de produits rapportent le plus."],
    [SHEETS.products, "Tous les produits vendus, du plus au moins vendu."],
    [SHEETS.lines, "Le détail de chaque vente, produit par produit."],
    [SHEETS.channels, "Où vous vendez (boutique, WhatsApp…) et comment vos clients paient."],
    [SHEETS.losses, "Ce que vous avez perdu, et pourquoi."],
    [SHEETS.stock, "Votre stock actuel, avec les produits à racheter en premier."],
  ];
  for (const [name, text] of toc) {
    ws.mergeCells(row, 2, row, 3);
    const link = ws.getCell(row, 2);
    link.value = sheetLink(name);
    link.font = font({ size: 11, bold: true, underline: true, color: { argb: COLORS.primary } });
    link.alignment = { vertical: "middle", indent: 1 };
    ws.mergeCells(row, 4, row, LAST_COL);
    const desc = ws.getCell(row, 4);
    desc.value = text;
    desc.font = font({ size: 10.5, color: { argb: COLORS.muted } });
    desc.alignment = { vertical: "middle" };
    for (let c = 2; c <= LAST_COL; c++) ws.getCell(row, c).border = { bottom: { style: "thin", color: { argb: COLORS.border } } };
    ws.getRow(row).height = 22;
    row++;
  }
  row += 1;
  ws.mergeCells(row, 2, row, LAST_COL);
  const note = ws.getCell(row, 2);
  note.value =
    "Montants en francs CFA, hors frais de livraison. Une vente compte quand elle est validée en caisse ; une commande, quand elle est livrée. Bénéfice = prix de vente − prix d'achat des produits vendus.";
  note.font = font({ size: 9, italic: true, color: { argb: COLORS.muted } });
  note.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(row).height = 30;
}

/** Les phrases clés du résumé, en mots simples. */
function highlights(d: SalesReportData, lossTotal: number, toBuy: number): string[] {
  const out: string[] = [];
  const { revenue, count } = d.summary;
  if (count === 0) {
    out.push("Aucune vente sur cette période.");
  } else {
    const best = d.series.reduce((b, s) => (s.revenue > b.revenue ? s : b), d.series[0]!);
    if (best && best.revenue > 0) out.push(`Votre meilleure journée : ${longDate(new Date(`${best.day}T12:00:00Z`))}, avec ${fcfa(best.revenue)} de ventes.`);
    const top = d.products[0];
    if (top) out.push(`Le produit qui rapporte le plus : ${top.name}, ${fcfa(top.revenue)} de ventes (${nf.format(top.quantity)} ${unitLabel(top.unit, top.quantity)}).`);
    const cat = [...d.categories].filter((c) => c.name !== "Sans catégorie").sort((a, b) => b.profit - a.profit)[0];
    if (cat && cat.profit > 0) out.push(`La catégorie la plus rentable : ${cat.name}, avec ${fcfa(cat.profit)} de bénéfice.`);
    const ch = d.channels[0];
    if (ch && d.channels.length > 1) out.push(`Vous vendez surtout ${channelPhrase(ch.key)} : ${Math.round(pct(ch.revenue, revenue) * 100)} % du montant des ventes.`);
    const m = d.methods.find((x) => x.key !== "inconnu");
    if (m) out.push(`Mode de paiement préféré de vos clients : ${methodLabel(m.key)} (${Math.round(pct(m.revenue, revenue) * 100)} % des ventes).`);
    const credit = d.methods.find((x) => x.key === "credit");
    if (credit && pct(credit.revenue, revenue) >= 0.15) {
      out.push(`${Math.round(pct(credit.revenue, revenue) * 100)} % de vos ventes sont à crédit : pensez à relancer vos clients (page « Clients et crédits »).`);
    }
  }
  if (lossTotal > 0) {
    const main = [...d.losses].sort((a, b) => b.value - a.value)[0]!;
    out.push(`Vous avez perdu ${fcfa(lossTotal)} de marchandise, surtout pour cette raison : ${reasonLabel(main.reason).toLowerCase()}.`);
  }
  if (toBuy > 0) out.push(`${toBuy} produit${toBuy > 1 ? "s sont" : " est"} à racheter (stock bas ou rupture) : voir l'onglet « ${SHEETS.stock} ».`);
  return out;
}

// ── Onglets détaillés ──────────────────────────────────────────────────────

const money = (header: string, width = 18, note?: string): Column => ({ header, width, format: FORMATS.money, sum: true, note });
const barColumn: Column = { header: "Aperçu", width: 20 };
const greenBar = (col: number) => (row: ExcelJS.Row) => {
  row.getCell(col).font = font({ size: 9, color: { argb: "FF5FA889" } });
};

function daysSheet(wb: ExcelJS.Workbook, d: SalesReportData) {
  const columns: Column[] = [
    { header: "Date", width: 13, format: FORMATS.day, align: "left" },
    { header: "Jour", width: 12 },
    money("Montant des ventes"),
    money("Bénéfice", 16),
    barColumn,
  ];
  const { ws, row } = startSheet(wb, {
    name: SHEETS.days,
    title: "Ventes par jour",
    intro: "Chaque jour de la période : ce que vous avez vendu, et ce qu'il vous en reste une fois payé le prix d'achat des produits.",
    meta: d.meta,
    widths: columns.map((c) => c.width),
  });
  const max = Math.max(0, ...d.series.map((s) => s.revenue));
  const rows = d.series.map((s) => {
    const date = new Date(`${s.day}T00:00:00Z`);
    return [date, WEEKDAYS[date.getUTCDay()]!, s.revenue, s.profit, textBar(s.revenue, max)];
  });
  writeTable(ws, row, columns, rows, { totalLabel: "Total", freeze: true, filter: true, styleRow: greenBar(5) });
}

function categoriesSheet(wb: ExcelJS.Workbook, d: SalesReportData) {
  const columns: Column[] = [
    { header: "Catégorie", width: 26 },
    money("Montant des ventes"),
    { header: "Part des ventes", width: 12, format: FORMATS.percent, sum: true },
    barColumn,
    money("Bénéfice", 16),
    { header: "Marge", width: 10, format: FORMATS.percent, note: "Sur 100 FCFA vendus, la part qui est du bénéfice." },
    { header: "Nombre de ventes", width: 12, format: FORMATS.number },
    { header: "Quantité vendue", width: 12 },
  ];
  const { ws, row } = startSheet(wb, {
    name: SHEETS.categories,
    title: "Ventes par catégorie",
    intro: "Quelles familles de produits rapportent le plus. Montants des produits vendus, avant remises.",
    meta: d.meta,
    widths: columns.map((c) => c.width),
  });
  const total = d.categories.reduce((s, c) => s + c.revenue, 0);
  const max = Math.max(0, ...d.categories.map((c) => c.revenue));
  const rows = d.categories.map((c) => [c.name, c.revenue, pct(c.revenue, total), textBar(c.revenue, max), c.profit, pct(c.profit, c.revenue), c.saleCount, c.quantity]);
  writeTable(ws, row, columns, rows, { totalLabel: "Total", emptyText: "Aucune vente sur cette période.", freeze: true, filter: true, styleRow: greenBar(4) });
}

function productsSheet(wb: ExcelJS.Workbook, d: SalesReportData) {
  const columns: Column[] = [
    { header: "Rang", width: 7, format: FORMATS.number, align: "center" },
    { header: "Produit", width: 34 },
    { header: "Catégorie", width: 20 },
    { header: "Quantité vendue", width: 12 },
    { header: "Unité", width: 10 },
    money("Montant des ventes"),
    money("Bénéfice", 16),
    { header: "Marge", width: 10, format: FORMATS.percent },
  ];
  const { ws, row } = startSheet(wb, {
    name: SHEETS.products,
    title: "Ventes par produit",
    intro: "Tous les produits vendus sur la période, classés du plus gros montant de ventes au plus petit.",
    meta: d.meta,
    widths: columns.map((c) => c.width),
  });
  const rows = d.products.map((p, i) => [i + 1, p.name, p.category ?? "Sans catégorie", p.quantity, unitLabel(p.unit, p.quantity), p.revenue, p.profit, pct(p.profit, p.revenue)]);
  writeTable(ws, row, columns, rows, { totalLabel: "Total", emptyText: "Aucune vente sur cette période.", freeze: true, filter: true });
}

function linesSheet(wb: ExcelJS.Workbook, d: SalesReportData) {
  const columns: Column[] = [
    { header: "Date et heure", width: 16, format: FORMATS.dateTime, align: "left" },
    { header: "N° de vente", width: 11 },
    { header: "Vente ou commande", width: 12 },
    { header: "Où", width: 12 },
    { header: "Boutique", width: 18 },
    { header: "Client", width: 20 },
    { header: "Vendeur", width: 16 },
    { header: "Produit", width: 30 },
    { header: "Catégorie", width: 18 },
    { header: "Quantité", width: 9 },
    { header: "Unité", width: 10 },
    { header: "Prix unitaire", width: 14, format: FORMATS.money },
    money("Total", 15),
    ...(d.showCost ? [money("Prix d'achat", 15, "Prix d'achat des produits de la ligne."), money("Bénéfice", 15)] : []),
    { header: "Paiement", width: 14 },
  ];
  const { ws, row } = startSheet(wb, {
    name: SHEETS.lines,
    title: "Toutes les ventes",
    intro:
      "Le détail de chaque vente, produit par produit : une vente de 3 produits occupe 3 lignes. Utilisez les flèches des titres pour trier ou filtrer." +
      (d.lineLimit ? ` Seules les ${nf.format(d.lineLimit)} premières lignes sont présentes : choisissez une période plus courte pour tout voir.` : ""),
    meta: d.meta,
    widths: columns.map((c) => c.width),
  });
  const rows = d.lines.map((l) => {
    const qty = Number(l.quantity);
    const cost = Math.round(l.unitCost * qty);
    return [
      l.completedAt,
      l.number,
      l.kind === "order" ? "Commande" : "Vente",
      channelLabel(l.channel),
      l.locationName,
      l.customerName ?? "",
      l.sellerName ?? "",
      l.product,
      l.category ?? "Sans catégorie",
      qty,
      unitLabel(l.unit, qty),
      l.unitPrice,
      l.lineTotal,
      ...(d.showCost ? [cost, l.lineTotal - cost] : []),
      l.paymentMethod ? methodLabel(l.paymentMethod) : "Non payé",
    ];
  });
  writeTable(ws, row, columns, rows, { totalLabel: "Total", emptyText: "Aucune vente sur cette période.", freeze: true, filter: true });
}

function channelsSheet(wb: ExcelJS.Workbook, d: SalesReportData) {
  const widths = [24, 18, 12, 20, 14];
  const { ws, row } = startSheet(wb, {
    name: SHEETS.channels,
    title: "Lieux de vente et paiements",
    intro: "Où vos clients achètent (en boutique ou à distance) et comment ils vous paient.",
    meta: d.meta,
    widths,
  });
  const block = (title: string, items: { label: string; revenue: number; count: number }[], start: number) => {
    const total = items.reduce((s, i) => s + i.revenue, 0);
    const max = Math.max(0, ...items.map((i) => i.revenue));
    const columns: Column[] = [
      { header: title, width: widths[0]! },
      money("Montant des ventes"),
      { header: "Part des ventes", width: 12, format: FORMATS.percent, sum: true },
      barColumn,
      { header: "Nombre de ventes", width: 14, format: FORMATS.number, sum: true },
    ];
    const rows = items.map((i) => [i.label, i.revenue, pct(i.revenue, total), textBar(i.revenue, max), i.count]);
    return writeTable(ws, start, columns, rows, { totalLabel: "Total", emptyText: "Aucune vente sur cette période.", styleRow: greenBar(4) });
  };
  const next = block("Où vous avez vendu", d.channels.map((c) => ({ label: channelLabel(c.key), revenue: c.revenue, count: c.count })), row);
  block("Comment vos clients ont payé", d.methods.map((m) => ({ label: methodLabel(m.key), revenue: m.revenue, count: m.count })), next + 1);
}

function lossesSheet(wb: ExcelJS.Workbook, d: SalesReportData) {
  const columns: Column[] = [
    { header: "Raison", width: 24 },
    { header: "Nombre de fois", width: 12, format: FORMATS.number, sum: true },
    { header: "Quantité perdue", width: 12 },
    money("Valeur perdue", 18, "Au prix d'achat des produits."),
  ];
  const { ws, row } = startSheet(wb, {
    name: SHEETS.losses,
    title: "Pertes",
    intro: "Produits cassés, volés, périmés ou manquants à l'inventaire, comptés au prix d'achat.",
    meta: d.meta,
    widths: columns.map((c) => c.width),
    tabColor: COLORS.danger,
  });
  const rows = d.losses.map((l) => [reasonLabel(l.reason), l.count, l.quantity, l.value]);
  writeTable(ws, row, columns, rows, { totalLabel: "Total", emptyText: "Aucune perte sur cette période. Bravo !", freeze: true });
}

function stockSheet(wb: ExcelJS.Workbook, d: SalesReportData) {
  const columns: Column[] = [
    { header: "Produit", width: 32 },
    { header: "Référence", width: 13 },
    { header: "Catégorie", width: 18 },
    { header: "Unité", width: 10 },
    { header: "En stock", width: 10 },
    { header: "Réservé pour commandes", width: 13, note: "Déjà promis à des commandes pas encore livrées." },
    { header: "Disponible", width: 11, note: "En stock moins ce qui est réservé : ce que vous pouvez vendre." },
    { header: "Seuil d'alerte", width: 11, note: "En dessous de cette quantité, le produit passe en « Stock bas »." },
    { header: "État", width: 12, align: "center" },
    ...(d.showCost ? [{ header: "Prix d'achat", width: 14, format: FORMATS.money }] : []),
    { header: "Prix de vente", width: 14, format: FORMATS.money },
    ...(d.showCost ? [money("Valeur du stock", 16, "Quantité en stock × prix d'achat.")] : []),
  ];
  const { ws, row } = startSheet(wb, {
    name: SHEETS.stock,
    title: `Stock actuel · ${d.locationName}`,
    intro: "Votre stock au moment de l'export. Les produits à racheter (rupture, puis stock bas) sont en haut de la liste.",
    meta: d.meta,
    widths: columns.map((c) => c.width),
  });
  const order: Record<StockStatus, number> = { out: 0, low: 1, ok: 2 };
  const products = [...d.stock].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, "fr"));
  const stateCol = 9;
  const rows = products.map((p) => [
    p.name,
    p.reference ?? "",
    p.categoryName ?? "Sans catégorie",
    unitLabel(p.unit, 1),
    p.physical,
    p.reserved,
    p.available,
    p.alertThreshold,
    STATUS[p.status].label,
    ...(d.showCost ? [p.costPrice ?? 0] : []),
    p.salePrice,
    ...(d.showCost ? [Math.round(Math.max(p.physical, 0) * (p.costPrice ?? 0))] : []),
  ]);
  writeTable(ws, row, columns, rows, {
    totalLabel: "Total",
    emptyText: "Aucun produit dans cette boutique.",
    freeze: true,
    filter: true,
    styleRow: (r, data) => {
      const status = Object.values(STATUS).find((s) => s.label === data[stateCol - 1]) ?? STATUS.ok;
      const cell = r.getCell(stateCol);
      cell.fill = solid(status.fill);
      cell.font = font({ bold: true, size: 10, color: { argb: status.color } });
    },
  });
}

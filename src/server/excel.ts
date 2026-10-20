import "server-only";
import ExcelJS from "exceljs";

/** Couleurs de l'application (globals.css), au format ARGB d'Excel. */
export const COLORS = {
  primary: "FF0B6E4F",
  primaryDark: "FF084F39",
  accent: "FFECF4EF",
  ink: "FF0B1310",
  muted: "FF58635E",
  border: "FFE5E8E5",
  zebra: "FFF7FAF8",
  white: "FFFFFFFF",
  saffron: "FFF59E0B",
  saffronSoft: "FFFEF3C7",
  warning: "FFB45309",
  danger: "FFDC2626",
  dangerSoft: "FFFDECEC",
} as const;

export const FORMATS = {
  money: '#,##0 "FCFA";[Red]-#,##0 "FCFA"',
  number: "#,##0",
  percent: "0.0 %",
  day: "dd/mm/yyyy",
  dateTime: "dd/mm/yyyy hh:mm",
} as const;

const FONT = "Calibri";

export interface ReportMeta {
  business: string;
  /** Ex. « du 21 septembre au 20 octobre 2026 ». */
  period: string;
}

export interface Column {
  header: string;
  /** Largeur en caractères. */
  width: number;
  format?: string;
  align?: "left" | "center" | "right";
  /** Colonne additionnée dans la ligne de total. */
  sum?: boolean;
  /** Bulle d'aide sur le titre de la colonne. */
  note?: string;
}

export function newWorkbook(title: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sama Stock";
  wb.company = "Sama Stock";
  wb.title = title;
  wb.created = new Date();
  return wb;
}

/** Nom d'onglet valide pour Excel (31 caractères, sans : \ / ? * [ ]). */
export function sheetName(name: string) {
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);
}

/** « & » a un sens particulier dans les en-têtes et pieds de page d'Excel. */
const footerText = (s: string) => s.replace(/&/g, "&&");

/**
 * Onglet au gabarit Sama Stock : titre, sous-titre (commerce · période), phrase d'explication,
 * sans quadrillage, prêt à imprimer en paysage sur une page de large.
 */
export function startSheet(
  wb: ExcelJS.Workbook,
  opts: { name: string; title: string; intro?: string; meta: ReportMeta; widths: number[]; tabColor?: string },
) {
  const ws = wb.addWorksheet(sheetName(opts.name), {
    properties: { tabColor: { argb: opts.tabColor ?? COLORS.primary } },
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&L&8${footerText(opts.meta.business)}&C&8${footerText(opts.title)}&R&8Page &P sur &N`,
    },
  });
  opts.widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const span = opts.widths.length;

  ws.mergeCells(1, 1, 1, span);
  const title = ws.getCell(1, 1);
  title.value = opts.title;
  title.font = { name: FONT, size: 18, bold: true, color: { argb: COLORS.primary } };
  title.alignment = { vertical: "middle" };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, span);
  const sub = ws.getCell(2, 1);
  sub.value = `${opts.meta.business}  ·  ${opts.meta.period}`;
  sub.font = { name: FONT, size: 11, color: { argb: COLORS.muted } };

  let row = 3;
  if (opts.intro) {
    ws.mergeCells(3, 1, 3, span);
    const intro = ws.getCell(3, 1);
    intro.value = opts.intro;
    intro.font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
    intro.alignment = { wrapText: true, vertical: "top" };
    const chars = opts.widths.reduce((s, w) => s + w, 0);
    ws.getRow(3).height = Math.max(16, Math.ceil(opts.intro.length / (chars * 1.1)) * 15);
    row = 4;
  }
  return { ws, row: row + 1 };
}

const thin = (argb: string): Partial<ExcelJS.Border> => ({ style: "thin", color: { argb } });

/**
 * Écrit un tableau à partir de la ligne `startRow` : titres sur fond vert, lignes alternées,
 * ligne de total facultative. Renvoie la première ligne libre après le tableau.
 */
export function writeTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  columns: Column[],
  rows: unknown[][],
  opts: { totalLabel?: string; emptyText?: string; freeze?: boolean; filter?: boolean; styleRow?: (row: ExcelJS.Row, data: unknown[]) => void } = {},
) {
  // Nombres et dates à droite, comme Excel le fait d'habitude
  const isNumeric = (v: unknown) => typeof v === "number" || v instanceof Date;
  const numericCol = columns.map((c, i) => Boolean(c.format) || rows.some((r) => isNumeric(r[i])));
  const align = (i: number, v?: unknown) => columns[i]!.align ?? (numericCol[i] && (v === undefined || v === null || isNumeric(v)) ? "right" : "left");

  // Avec les filtres, Excel place un bouton à droite de chaque titre : on lui laisse la place
  const button = opts.filter && rows.length > 0 ? 3 : 0;
  const header = ws.getRow(startRow);
  let lines = 1;
  columns.forEach((c, i) => {
    const width = c.width + button;
    if (button) ws.getColumn(i + 1).width = Math.max(ws.getColumn(i + 1).width ?? 0, width);
    lines = Math.max(lines, Math.ceil((c.header.length * 1.1) / Math.max(4, width - button - 1)));
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 10.5, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.primary } };
    cell.alignment = { vertical: "middle", horizontal: align(i), wrapText: true, indent: button && align(i) === "right" ? 2 : 0 };
    cell.border = { bottom: thin(COLORS.primaryDark), right: thin(COLORS.primaryDark) };
    if (c.note) cell.note = c.note;
  });
  header.height = Math.max(32, Math.min(3, lines) * 15 + 4);

  const first = startRow + 1;
  const zebra = rows.length <= 5000;
  rows.forEach((data, r) => {
    const row = ws.getRow(first + r);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = data[i];
      cell.value = v === undefined ? null : (v as ExcelJS.CellValue);
      cell.font = { name: FONT, size: 10.5, color: { argb: COLORS.ink } };
      if (c.format) cell.numFmt = c.format;
      cell.alignment = { vertical: "middle", horizontal: align(i, v) };
      cell.border = { bottom: thin(COLORS.border) };
      if (zebra && r % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.zebra } };
    });
    row.height = 18;
    opts.styleRow?.(row, data);
  });

  let next = first + rows.length;
  if (rows.length === 0 && opts.emptyText) {
    ws.mergeCells(next, 1, next, columns.length);
    const cell = ws.getCell(next, 1);
    cell.value = opts.emptyText;
    cell.font = { name: FONT, size: 10.5, italic: true, color: { argb: COLORS.muted } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(next).height = 24;
    next++;
  } else if (rows.length > 0 && opts.totalLabel) {
    const total = ws.getRow(next);
    columns.forEach((c, i) => {
      const cell = total.getCell(i + 1);
      if (i === 0) cell.value = opts.totalLabel!;
      else if (c.sum) {
        const letter = ws.getColumn(i + 1).letter;
        const result = rows.reduce((s, d) => s + (typeof d[i] === "number" ? (d[i] as number) : 0), 0);
        cell.value = { formula: `SUM(${letter}${first}:${letter}${next - 1})`, result };
        if (c.format) cell.numFmt = c.format;
      }
      cell.font = { name: FONT, size: 10.5, bold: true, color: { argb: COLORS.ink } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.accent } };
      cell.border = { top: { style: "medium", color: { argb: COLORS.primary } } };
      cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : align(i) };
    });
    total.height = 22;
    next++;
  }

  if (opts.freeze) ws.views = [{ state: "frozen", ySplit: startRow, showGridLines: false }];
  if (opts.filter && rows.length > 0) {
    ws.autoFilter = { from: { row: startRow, column: 1 }, to: { row: first + rows.length - 1, column: columns.length } };
  }
  if (opts.freeze) ws.pageSetup.printTitlesRow = `${startRow}:${startRow}`;
  return next + 1;
}

/** Petit titre de section dans un onglet. */
export function sectionTitle(ws: ExcelJS.Worksheet, row: number, text: string, span: number, col = 1) {
  ws.mergeCells(row, col, row, col + span - 1);
  const cell = ws.getCell(row, col);
  cell.value = text;
  cell.font = { name: FONT, size: 13, bold: true, color: { argb: COLORS.primary } };
  cell.border = { bottom: { style: "medium", color: { argb: COLORS.primary } } };
  ws.getRow(row).height = 24;
}

/** Barre proportionnelle dessinée avec des caractères (lisible partout, même imprimée). */
export function textBar(share: number, max = 1, length = 16) {
  if (share <= 0 || max <= 0) return "";
  return "█".repeat(Math.max(1, Math.round((share / max) * length)));
}

/**
 * Lien vers un autre onglet du classeur. Lien « natif » avec « # » : vérifié dans Excel
 * (une formule HYPERLINK écrite par ExcelJS déclenche une réparation du fichier à l'ouverture).
 */
export function sheetLink(name: string, label = name): ExcelJS.CellHyperlinkValue {
  return { text: label, hyperlink: `#'${sheetName(name).replace(/'/g, "''")}'!A1`, tooltip: `Aller à l'onglet « ${name} »` };
}

export const font = (opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: FONT, size: 10.5, color: { argb: COLORS.ink }, ...opts });

export const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** Nom de fichier sans accents ni caractères spéciaux. */
export function fileSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function workbookResponse(wb: ExcelJS.Workbook, filename: string) {
  const data = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(data as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

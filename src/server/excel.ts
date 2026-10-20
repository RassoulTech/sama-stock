import "server-only";
import * as XLSX from "xlsx";

export const FCFA = "#,##0";
export const PERCENT = "0.0%";
export const DAY_FORMAT = "dd/mm/yyyy";
export const DATETIME_FORMAT = "dd/mm/yyyy hh:mm";

export interface Column {
  header: string;
  /** Largeur en caractères. */
  width?: number;
  /** Format Excel des nombres ou des dates de la colonne. */
  format?: string;
}

export function newWorkbook() {
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: "Sama Stock", Author: "Sama Stock", CreatedDate: new Date() };
  return wb;
}

/** Nom d'onglet valide pour Excel (31 caractères, sans : \ / ? * [ ]). */
function sheetName(name: string) {
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);
}

/** Ajoute un onglet : ligne de titres, largeurs, formats et filtres automatiques. */
export function addTable(wb: XLSX.WorkBook, name: string, columns: Column[], rows: unknown[][]) {
  const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.header), ...rows], { cellDates: true });
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? Math.max(12, c.header.length + 2) }));
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  columns.forEach((c, ci) => {
    if (!c.format) return;
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: ci })] as XLSX.CellObject | undefined;
      if (cell && (cell.t === "n" || cell.t === "d")) cell.z = c.format;
    }
  });
  if (rows.length > 0) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: columns.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, ws, sheetName(name));
}

/** Onglet libre (lignes déjà composées), avec formats par cellule : [ligne, colonne, format]. */
export function addSheet(wb: XLSX.WorkBook, name: string, rows: unknown[][], widths: number[], formats: [number, number, string][] = []) {
  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  ws["!cols"] = widths.map((wch) => ({ wch }));
  for (const [r, c, z] of formats) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
    if (cell) cell.z = z;
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetName(name));
}

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

export function workbookResponse(wb: XLSX.WorkBook, filename: string) {
  const data = XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

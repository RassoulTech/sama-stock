"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatFCFA, formatQty } from "@/lib/format";
import {
  autoMap,
  buildRows,
  detectEuro,
  detectHeaderRow,
  EUR_TO_FCFA,
  IGNORED_LABELS,
  IMPORT_BATCH,
  IMPORT_FIELD_KEYS,
  IMPORT_FIELDS,
  normalizeText,
  shouldConvertEuro,
  type Cell,
  type ColumnGuess,
  type ImportField,
} from "@/lib/import/products";
import { cn } from "@/lib/utils";
import { importProductsBatch, type ImportBatchResult } from "@/server/actions/import";

const NONE = "__none__";
const ACCEPT = ".xlsx,.xls,.xlsm,.csv,.ods,.txt";

interface Sheet {
  name: string;
  rows: Cell[][];
  /** Valeurs telles qu'affichées dans Excel (pour repérer « 20,00 € »). */
  display: Cell[][];
  /** Numéro de la première ligne lue (comme dans Excel). */
  firstRow: number;
}

/** Lit le classeur dans le navigateur : le fichier n'est jamais envoyé tel quel au serveur. */
async function readFile(file: File): Promise<Sheet[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  let workbook;
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder("windows-1252").decode(buffer); // CSV enregistré par Excel en français
    }
    text = text.replace(/^﻿/, "");
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const sep = [";", "\t", ","].map((d) => [d, firstLine.split(d).length - 1] as const).sort((a, b) => b[1] - a[1])[0]!;
    workbook = XLSX.read(text, { type: "string", FS: sep[1] > 0 ? sep[0] : ",", raw: true });
  } else {
    workbook = XLSX.read(buffer, { type: "array" });
  }
  return workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name]!;
    const start = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).s.r : 0;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const display = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: false, defval: null, blankrows: true });
    return { name, rows, display, firstRow: start + 1 };
  });
}

const columnName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

const show = (v: Cell) => (v === null || v === undefined ? "" : v instanceof Date ? v.toLocaleDateString("fr-FR") : String(v));

export function ProductImport({
  existing,
  productCount,
  maxProducts,
  planLabel,
}: {
  existing: { names: string[]; references: string[] };
  productCount: number;
  maxProducts: number | null;
  planLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(-1);
  const [guesses, setGuesses] = useState<ColumnGuess[]>([]);
  const [mapping, setMapping] = useState<(ImportField | null)[]>([]);
  const [mode, setMode] = useState<"ignorer" | "mettre-a-jour">("ignorer");
  const [convertEuro, setConvertEuro] = useState(false);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<(ImportBatchResult & { error?: string }) | null>(null);
  const [dragging, setDragging] = useState(false);

  const sheet = sheets[sheetIndex];

  function analyse(s: Sheet, forcedHeader?: number) {
    const header = forcedHeader ?? detectHeaderRow(s.rows);
    const data = s.rows.slice(header + 1);
    const g = autoMap(header >= 0 ? s.rows[header]! : [], data);
    setHeaderRow(header);
    setGuesses(g);
    setMapping(g.map((x) => x.field));
    setConvertEuro(shouldConvertEuro(data, g.map((x) => x.field)));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReadError(null);
    setResult(null);
    setReading(true);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Fichier trop lourd (15 Mo au plus).");
      const all = (await readFile(file)).filter((s) => s.rows.some((r) => r.some((c) => show(c).trim() !== "")));
      if (all.length === 0) throw new Error("Ce fichier ne contient aucune donnée.");
      // La feuille la plus remplie est choisie par défaut
      const best = all.reduce((b, s, i) => (s.rows.length > all[b]!.rows.length ? i : b), 0);
      setFileName(file.name);
      setSheets(all);
      setSheetIndex(best);
      analyse(all[best]!);
    } catch (e) {
      setReadError(e instanceof Error && e.message ? e.message : "Impossible de lire ce fichier. Enregistrez-le au format Excel (.xlsx) ou CSV.");
      setSheets([]);
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const dataRows = useMemo(() => (sheet ? sheet.rows.slice(headerRow + 1) : []), [sheet, headerRow]);
  const firstLine = sheet ? sheet.firstRow + headerRow + 1 : 1;
  const euro = useMemo(() => (sheet ? detectEuro(sheet.display.slice(headerRow + 1), mapping) : false), [sheet, headerRow, mapping]);
  // Sans colonne d'unité, une colonne de taille peut donner le contenant (« Sac de 11 kg » → sac)
  const sizeColumn = mapping.includes("unit") ? -1 : guesses.findIndex((g, i) => g.ignored === "taille" && mapping[i] === null);
  const rows = useMemo(
    () =>
      mapping.includes("name")
        ? buildRows(dataRows, mapping, firstLine, {
            sizeColumn: sizeColumn >= 0 ? sizeColumn : undefined,
            priceFactor: euro && convertEuro ? EUR_TO_FCFA : 1,
          })
        : [],
    [dataRows, mapping, firstLine, sizeColumn, euro, convertEuro],
  );
  const valid = rows.filter((r) => !r.error);
  const rejected = rows.filter((r) => r.error);
  const warned = valid.filter((r) => r.warnings.length > 0);

  const existingNames = useMemo(() => new Set(existing.names), [existing.names]);
  const existingRefs = useMemo(() => new Set(existing.references), [existing.references]);
  const isExisting = (r: (typeof rows)[number]) =>
    (r.reference !== "" && existingRefs.has(normalizeText(r.reference))) || existingNames.has(normalizeText(r.name));
  const already = valid.filter(isExisting).length;
  const fresh = valid.length - already;
  const room = maxProducts === null ? Number.POSITIVE_INFINITY : Math.max(0, maxProducts - productCount);

  const columnCount = Math.max(guesses.length, ...dataRows.slice(0, 50).map((r) => r.length), 0);
  const samples = (col: number) =>
    dataRows
      .map((r) => show(r[col]).trim())
      .filter(Boolean)
      .slice(0, 3);

  function setField(col: number, field: ImportField | null) {
    setMapping((m) => m.map((f, i) => (i === col ? field : f === field && field !== null ? null : f)));
  }

  async function runImport() {
    setProgress(0);
    const total: ImportBatchResult & { error?: string } = {
      created: 0,
      updated: 0,
      skipped: rejected.map((r) => ({ line: r.line, name: r.name || "(sans nom)", reason: r.error! })),
    };
    for (let i = 0; i < valid.length; i += IMPORT_BATCH) {
      const batch = valid.slice(i, i + IMPORT_BATCH).map((r) => ({
        line: r.line,
        name: r.name,
        reference: r.reference,
        category: r.category,
        unit: r.unit,
        costPrice: r.costPrice,
        salePrice: r.salePrice,
        stock: r.stock,
        alertThreshold: r.alertThreshold,
      }));
      const res = await importProductsBatch({ rows: batch, existing: mode });
      if (!res.ok) {
        total.error = res.error;
        break;
      }
      total.created += res.data.created;
      total.updated += res.data.updated;
      total.skipped.push(...res.data.skipped);
      setProgress(Math.round(((i + batch.length) / valid.length) * 100));
    }
    total.skipped.sort((a, b) => a.line - b.line);
    setResult(total);
    setProgress(null);
  }

  function reset() {
    setSheets([]);
    setFileName(null);
    setResult(null);
    setReadError(null);
  }

  // ── Étape 3 : bilan ──
  if (result) {
    return (
      <Card>
        <CardContent className="space-y-5 py-6">
          <div className="flex items-start gap-3">
            {result.error ? <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" /> : <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" />}
            <div>
              <p className="text-lg font-semibold">{result.error ? "Import interrompu" : "Import terminé"}</p>
              {result.error && <p className="text-sm text-destructive">{result.error}</p>}
              <p className="text-sm text-muted-foreground">
                {result.created} produit{result.created > 1 ? "s" : ""} créé{result.created > 1 ? "s" : ""}
                {result.updated > 0 && ` · ${result.updated} mis à jour`}
                {result.skipped.length > 0 && ` · ${result.skipped.length} non importé${result.skipped.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          {result.skipped.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ligne</th>
                    <th className="px-3 py-2 font-medium">Produit</th>
                    <th className="px-3 py-2 font-medium">Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {result.skipped.map((s) => (
                    <tr key={`${s.line}-${s.name}`} className="border-t">
                      <td className="num px-3 py-2">{s.line}</td>
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/produits">Voir mes produits</Link>
            </Button>
            <Button variant="outline" onClick={reset}>
              <RotateCcw /> Importer un autre fichier
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Étape 1 : choix du fichier ──
  if (!sheet) {
    return (
      <div className="space-y-4">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void onFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-card px-6 py-12 text-center transition-colors hover:border-primary/50 hover:bg-accent/30",
            dragging && "border-primary bg-accent/50",
          )}
        >
          <span className="grid size-14 place-items-center rounded-xl bg-accent text-primary">
            {reading ? <Loader2 className="size-7 animate-spin" /> : <Upload className="size-7" />}
          </span>
          <span className="text-base font-semibold">{reading ? "Lecture du fichier…" : "Déposez votre fichier ici, ou cliquez pour le choisir"}</span>
          <span className="max-w-md text-sm text-muted-foreground">
            Excel (.xlsx, .xls), CSV ou OpenOffice. Vos colonnes n&apos;ont pas besoin d&apos;être dans un ordre précis : Sama Stock
            les reconnaît et vous laisse vérifier avant d&apos;importer.
          </span>
          <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        {readError && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {readError}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <FileSpreadsheet className="size-4 text-primary" /> Pas encore de fichier ?
          <a href="/api/produits/modele" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <Download className="size-3.5" /> Télécharger le modèle Excel
          </a>
        </p>
      </div>
    );
  }

  // ── Étape 2 : colonnes et aperçu ──
  const hasName = mapping.includes("name");
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 font-semibold">
              <FileSpreadsheet className="size-4 text-primary" /> <span className="truncate">{fileName}</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {rows.length} ligne{rows.length > 1 ? "s" : ""} de produits trouvée{rows.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sheets.length > 1 && (
              <Select
                value={String(sheetIndex)}
                onValueChange={(v) => {
                  setSheetIndex(Number(v));
                  analyse(sheets[Number(v)]!);
                }}
              >
                <SelectTrigger className="w-48" aria-label="Feuille">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((s, i) => (
                    <SelectItem key={s.name} value={String(i)}>
                      Feuille : {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={String(headerRow)} onValueChange={(v) => analyse(sheet, Number(v))}>
              <SelectTrigger className="w-56" aria-label="Ligne des titres">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-1">Pas de ligne de titres</SelectItem>
                {sheet.rows.slice(0, 15).map((_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    Titres en ligne {sheet.firstRow + i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw /> Autre fichier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Vérifiez à quoi correspond chaque colonne de votre fichier. Corrigez si besoin, ou choisissez « Ne pas importer ».
          </p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Colonne du fichier</th>
                  <th className="px-3 py-2 font-medium">Exemples</th>
                  <th className="px-3 py-2 font-medium">Dans Sama Stock</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: columnCount }, (_, col) => {
                  const title = headerRow >= 0 ? show(sheet.rows[headerRow]?.[col]).trim() : "";
                  const ex = samples(col);
                  if (!title && ex.length === 0) return null;
                  const field = mapping[col] ?? null;
                  const guess = guesses[col];
                  return (
                    <tr key={col} className="border-t">
                      <td className="px-3 py-2.5 align-top">
                        <span className="font-medium">{title || `Colonne ${columnName(col)}`}</span>
                      </td>
                      <td className="max-w-64 px-3 py-2.5 align-top text-muted-foreground">
                        <span className="line-clamp-2">{ex.join(" · ") || "—"}</span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <Select value={field ?? NONE} onValueChange={(v) => setField(col, v === NONE ? null : (v as ImportField))}>
                            <SelectTrigger className={cn("w-52", field && "border-primary/40")} aria-label={`Champ pour ${title || columnName(col)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Ne pas importer</SelectItem>
                              {IMPORT_FIELD_KEYS.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {IMPORT_FIELDS[f]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {field && guess?.field === field && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                guess.source === "titre" ? "bg-accent text-accent-foreground" : "bg-saffron/15 text-warning dark:text-saffron",
                              )}
                            >
                              {guess.source === "titre" ? "Reconnue" : "Devinée"}
                              {guess.note && ` · ${guess.note}`}
                            </span>
                          )}
                          {!field && guess?.ignored && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {IGNORED_LABELS[guess.ignored]}
                              {col === sizeColumn && " (le contenant sert d'unité)"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!hasName && (
            <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4" /> Indiquez quelle colonne contient le nom des produits.
            </p>
          )}
          {euro && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
              <Switch id="convert-euro" checked={convertEuro} onCheckedChange={setConvertEuro} />
              <Label htmlFor="convert-euro" className="block flex-1 leading-snug font-normal">
                Les prix de ce fichier sont en euros (€). <strong>Les convertir en FCFA</strong> (1 € = 655,957 FCFA). Laissez
                désactivé si vos montants sont déjà en FCFA.
              </Label>
            </div>
          )}
          {hasName && !mapping.includes("salePrice") && (
            <p className="mt-3 flex items-center gap-2 text-sm text-warning dark:text-saffron">
              <AlertTriangle className="size-4" /> Aucune colonne de prix de vente : les produits seront créés à 0 FCFA.
            </p>
          )}
        </CardContent>
      </Card>

      {hasName && (
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Aperçu</CardTitle>
            <p className="text-sm text-muted-foreground">
              {valid.length} produit{valid.length > 1 ? "s" : ""} prêt{valid.length > 1 ? "s" : ""}
              {already > 0 && ` · dont ${already} déjà dans votre catalogue`}
              {warned.length > 0 && ` · ${warned.length} avec une remarque`}
              {rejected.length > 0 && ` · ${rejected.length} ligne${rejected.length > 1 ? "s" : ""} écartée${rejected.length > 1 ? "s" : ""}`}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ligne</th>
                    <th className="px-3 py-2 font-medium">Produit</th>
                    <th className="px-3 py-2 font-medium">Catégorie</th>
                    <th className="px-3 py-2 text-right font-medium">Prix d&apos;achat</th>
                    <th className="px-3 py-2 text-right font-medium">Prix de vente</th>
                    <th className="px-3 py-2 text-right font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {valid.slice(0, 8).map((r) => (
                    <tr key={r.line} className="border-t">
                      <td className="num px-3 py-2 text-muted-foreground">{r.line}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{r.name}</span>
                        {r.reference && <span className="ml-1.5 text-xs text-muted-foreground">{r.reference}</span>}
                        {isExisting(r) && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">existe déjà</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.category || "—"}</td>
                      <td className="num px-3 py-2 text-right whitespace-nowrap">{formatFCFA(r.costPrice)}</td>
                      <td className="num px-3 py-2 text-right font-semibold whitespace-nowrap">{formatFCFA(r.salePrice)}</td>
                      <td className="num px-3 py-2 text-right whitespace-nowrap">{formatQty(r.stock, r.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {valid.length > 8 && <p className="-mt-3 text-xs text-muted-foreground">… et {valid.length - 8} autres produits.</p>}

            {(warned.length > 0 || rejected.length > 0) && (
              <details className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium">Voir les remarques ({warned.length + rejected.length})</summary>
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {rejected.map((r) => (
                    <li key={`e${r.line}`} className="text-destructive">
                      Ligne {r.line} {r.name && `(${r.name})`} : {r.error} — non importée
                    </li>
                  ))}
                  {warned.map((r) => (
                    <li key={`w${r.line}`} className="text-muted-foreground">
                      Ligne {r.line} ({r.name}) : {r.warnings.join(" ; ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {already > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Pour les {already} produit{already > 1 ? "s" : ""} déjà présent{already > 1 ? "s" : ""} (même nom ou même référence) :</p>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="gap-2">
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="ignorer" /> Les laisser tels quels
                  </Label>
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="mettre-a-jour" /> Mettre à jour leurs prix, catégorie et seuil (le stock ne change pas)
                  </Label>
                </RadioGroup>
              </div>
            )}

            {fresh > room && (
              <p className="flex items-start gap-2 rounded-xl bg-saffron/12 px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning dark:text-saffron" />
                La formule {planLabel} est limitée à {maxProducts} produits : seuls les {room} premiers nouveaux produits seront
                importés. Passez à Business pour des produits illimités.
              </p>
            )}

            {progress !== null ? (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground">Import en cours… {progress} %</p>
              </div>
            ) : (
              <Button size="lg" disabled={valid.length === 0} onClick={() => void runImport()}>
                <Upload /> Importer {valid.length} produit{valid.length > 1 ? "s" : ""}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

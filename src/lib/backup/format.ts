import { createHash } from "node:crypto";

/** Format des fichiers de sauvegarde ; à augmenter si la structure change. */
export const BACKUP_FORMAT = 1;
export const BACKUP_ROOT = "sauvegardes";
export const INDEX_PATH = `${BACKUP_ROOT}/index.json`;

export const RUN_KINDS = ["nuit", "manuelle", "avant-restauration"] as const;
export type RunKind = (typeof RUN_KINDS)[number];
export type RunState = "ok" | "partiel" | "echec";

export interface BackupFileEntry {
  type: "boutique" | "admin";
  businessId: string | null;
  name: string;
  /** Chemin du contenu dans le coffre (dans une passe précédente si rien n'a changé). */
  path: string;
  bytes: number;
  sha256: string;
  counts: Record<string, number>;
  /** Contenu identique à la passe d'avant : chemin du fichier réutilisé, sinon null. */
  sameAs: string | null;
}

/** Sommaire d'une passe (`sommaire.json`), rangé avec les fichiers. */
export interface Manifest {
  format: number;
  runId: string;
  kind: RunKind;
  startedAt: string;
  finishedAt: string;
  state: RunState;
  migration: string;
  files: BackupFileEntry[];
  errors: { name: string; message: string }[];
}

/** Contenu d'un fichier de sauvegarde (boutique ou admin). */
export interface BackupPayload {
  format: number;
  type: "boutique" | "admin";
  createdAt: string;
  migration: string;
  businessId: string | null;
  name: string;
  counts: Record<string, number>;
  tables: Record<string, Record<string, unknown>[]>;
}

/** Ligne de l'index (`sauvegardes/index.json`) : ce que la page admin affiche sans ouvrir chaque sommaire. */
export interface RunSummary {
  runId: string;
  kind: RunKind;
  state: RunState;
  startedAt: string;
  finishedAt: string;
  shops: number;
  /** Octets écrits par cette passe (les fichiers réutilisés ne comptent pas). */
  bytes: number;
  githubAt: string | null;
}

/** « 2026-10-29T02-04-05Z-nuit » : lisible, triable, sans caractère gênant dans un chemin. */
export function runIdFor(kind: RunKind, date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)}T${iso.slice(11, 13)}-${iso.slice(14, 16)}-${iso.slice(17, 19)}Z-${kind}`;
}

export function parseRunId(id: string): { date: Date; kind: RunKind } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z-(nuit|manuelle|avant-restauration)$/.exec(id);
  if (!m) return null;
  return { date: new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`), kind: m[5] as RunKind };
}

export const runPrefix = (runId: string) => `${BACKUP_ROOT}/${runId}/`;
export const manifestPath = (runId: string) => `${runPrefix(runId)}sommaire.json`;
export const shopFilePath = (runId: string, businessId: string) => `${runPrefix(runId)}boutique-${businessId}.json.gz`;
export const adminFilePath = (runId: string) => `${runPrefix(runId)}admin.json.gz`;

/** Chemin autorisé dans les adresses de téléchargement : dans le coffre, sans « .. » ni caractère exotique. */
export function isBackupPath(path: string): boolean {
  return path.startsWith(`${BACKUP_ROOT}/`) && !path.includes("..") && /^[A-Za-z0-9_./-]+$/.test(path);
}

/** Ordre stable : par identifiant, sinon par contenu (stock_levels n'a pas d'identifiant). */
export function sortRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  const key = (r: T) => (typeof r.id === "string" ? r.id : JSON.stringify(r));
  return [...rows].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export function contentHash(tables: Record<string, Record<string, unknown>[]>): string {
  return createHash("sha256").update(JSON.stringify(tables)).digest("hex");
}

export function countRows(tables: Record<string, unknown[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(tables).map(([k, rows]) => [k, rows.length]));
}

/** « 0012_pannes » → 12. */
export function migrationNumber(tag: string): number {
  const m = /^(\d{4})_/.exec(tag);
  return m ? Number(m[1]) : -1;
}

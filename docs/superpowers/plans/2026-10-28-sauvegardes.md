# Sauvegardes de chaque nuit — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chaque nuit, un fichier par boutique et un fichier admin sont rangés dans un coffre privé Vercel Blob (copié ensuite par GitHub) ; depuis Admin › Sauvegardes, on télécharge ou on restaure **une** boutique (ou les données admin) sans toucher au reste.

**Architecture:** modules purs testés (`src/lib/backup/` : format, conservation, comparaison) ; côté serveur (`src/server/backup/`) : registre des tables Drizzle, export, coffre (Vercel Blob ou dossier local), passes (nuit, manuelle, avant-restauration) avec un index `sauvegardes/index.json`, restauration transactionnelle. Déclencheurs : tâche planifiée Vercel, bouton admin, workflow GitHub qui télécharge avec une clé.

**Tech Stack:** Next.js 16.4 (route handlers, `maxDuration`, server actions), Drizzle (`getTableColumns`, `getTableConfig`), Postgres Neon, `@vercel/blob` 2.8.2 (stockage `private`, envoi navigateur `@vercel/blob/client`), `node:zlib`, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-28-sauvegardes-et-pannes-design.md` (sections « Sauvegardes » à « Restauration totale »).

## Global Constraints

- Offres gratuites : Neon free, Vercel Hobby (tâche planifiée une fois par jour, fonction 300 s au plus).
- Démos jamais sauvegardées. Jamais sauvegardé : `notifications`, `push_subscriptions`, `session`, `verification`, `subscription_events`, `subscription_checkouts`, `app_errors`. Jetons OAuth (`access_token`, `refresh_token`, `id_token`) jamais copiés.
- Conservation : passes « nuit » 30 jours + la première passe « nuit » réussie de chaque mois pendant 12 mois ; « manuelle » et « avant-restauration » 30 jours.
- Restauration d'une boutique : garde les colonnes gérées par l'admin (`plan`, `trialEndsAt`, `periodEndsAt`, `suspendedAt`, `isDemo`, `demoResetAt`, `licensePack`, `licenseActivatedAt`, `maintenanceEndsAt`, `slug`, `brandColor`), compteurs = le plus grand, utilisateurs existants jamais modifiés, copie « avant-restauration » d'abord.
- Clé `CRON_SECRET` (au moins 32 caractères), comparée en temps constant ; même valeur dans GitHub sous `SAUVEGARDE_CLE`.
- Le développeur n'écrit jamais de secret dans Vercel ou GitHub : l'utilisateur les colle (guidé).
- Tests de restauration sur une **branche Neon temporaire**, jamais sur la vraie base.
- Textes visibles en français simple. Pas de prettier. Push = accord de l'utilisateur (c'est lui qui tape `! git push origin master`).
- Dans le code, les champs du sommaire s'appellent en anglais (`runId`, `sameAs`…) ; le fichier s'appelle `sommaire.json`.

---

### Task 1: Format, conservation et comparaison (fonctions pures)

**Files:**
- Create: `src/lib/backup/format.ts`, `src/lib/backup/retention.ts`, `src/lib/backup/compare.ts`
- Test: `src/lib/backup/backup.test.ts`

**Interfaces:**
- Produces: `BACKUP_FORMAT`, `BACKUP_ROOT`, types `RunKind`, `RunState`, `BackupFileEntry`, `Manifest`, `BackupPayload`, `RunSummary` ; `runIdFor(kind, date)`, `parseRunId(id)`, `runPrefix(runId)`, `manifestPath(runId)`, `shopFilePath(runId, businessId)`, `adminFilePath(runId)`, `INDEX_PATH`, `isBackupPath(path)`, `sortRows(rows)`, `contentHash(tables)`, `countRows(tables)`, `migrationNumber(tag)` ; `runsToDelete(runs, now)`, `filesToDelete(files, deletedRunIds, keptManifests)`, `githubCopyMissing(runs, now)` ; `restoreImpact(saved, current)`.

- [ ] **Step 1: Écrire les tests** (`src/lib/backup/backup.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { restoreImpact } from "./compare";
import { contentHash, countRows, isBackupPath, migrationNumber, parseRunId, runIdFor, shopFilePath, sortRows, type Manifest } from "./format";
import { filesToDelete, githubCopyMissing, runsToDelete } from "./retention";

describe("noms des passes", () => {
  it("écrit et relit le nom d'une passe", () => {
    const id = runIdFor("nuit", new Date("2026-10-29T02:04:05.123Z"));
    expect(id).toBe("2026-10-29T02-04-05Z-nuit");
    expect(parseRunId(id)).toEqual({ date: new Date("2026-10-29T02:04:05Z"), kind: "nuit" });
    expect(parseRunId("2026-10-29T02-04-05Z-avant-restauration")?.kind).toBe("avant-restauration");
    expect(parseRunId("n'importe quoi")).toBeNull();
  });
  it("n'accepte que des chemins du coffre", () => {
    expect(isBackupPath(shopFilePath("2026-10-29T02-04-05Z-nuit", "4db17195-b4e0-44cb-ac80-451a025d0c3f"))).toBe(true);
    expect(isBackupPath("sauvegardes/importes/fichier-AbC123.json.gz")).toBe(true);
    expect(isBackupPath("sauvegardes/../.env")).toBe(false);
    expect(isBackupPath("autre/fichier.json.gz")).toBe(false);
    expect(isBackupPath("sauvegardes/a b.json")).toBe(false);
  });
  it("lit le numéro d'une migration", () => {
    expect(migrationNumber("0012_pannes")).toBe(12);
    expect(migrationNumber("inconnu")).toBe(-1);
  });
});

describe("contenu", () => {
  it("trie les lignes pour que la même boutique donne la même empreinte", () => {
    const a = { sales: [{ id: "b", n: 2 }, { id: "a", n: 1 }], stockLevels: [{ productId: "p2", qty: 1 }, { productId: "p1", qty: 3 }] };
    const b = { sales: [{ id: "a", n: 1 }, { id: "b", n: 2 }], stockLevels: [{ productId: "p1", qty: 3 }, { productId: "p2", qty: 1 }] };
    const sort = (t: Record<string, Record<string, unknown>[]>) => Object.fromEntries(Object.entries(t).map(([k, rows]) => [k, sortRows(rows)]));
    expect(contentHash(sort(a))).toBe(contentHash(sort(b)));
    expect(contentHash(sort(a))).not.toBe(contentHash({ ...sort(a), sales: [] }));
    expect(countRows(a)).toEqual({ sales: 2, stockLevels: 2 });
  });
});

const run = (runId: string, state: "ok" | "partiel" | "echec" = "ok", githubAt: string | null = null) => ({ runId, state, githubAt });

describe("conservation", () => {
  const now = new Date("2026-10-29T03:00:00Z");
  it("garde 30 nuits, efface les plus vieilles", () => {
    const del = runsToDelete([run("2026-10-28T02-00-00Z-nuit"), run("2026-09-20T02-00-00Z-nuit"), run("2026-09-30T02-00-00Z-nuit")], now);
    expect(del).toEqual(["2026-09-20T02-00-00Z-nuit"]);
  });
  it("garde la première nuit réussie de chaque mois pendant un an", () => {
    const runs = [run("2026-08-01T02-00-00Z-nuit", "echec"), run("2026-08-02T02-00-00Z-nuit"), run("2026-08-03T02-00-00Z-nuit"), run("2025-09-01T02-00-00Z-nuit")];
    expect(runsToDelete(runs, now).sort()).toEqual(["2025-09-01T02-00-00Z-nuit", "2026-08-01T02-00-00Z-nuit", "2026-08-03T02-00-00Z-nuit"]);
  });
  it("garde 30 jours les passes manuelles et avant restauration, et ne touche pas aux noms inconnus", () => {
    const runs = [run("2026-10-01T10-00-00Z-manuelle"), run("2026-09-01T10-00-00Z-avant-restauration"), { runId: "bizarre", state: "ok" as const, githubAt: null }];
    expect(runsToDelete(runs, now)).toEqual(["2026-09-01T10-00-00Z-avant-restauration"]);
  });
  it("n'efface jamais un fichier encore utilisé par une passe gardée", () => {
    const kept: Manifest[] = [
      {
        format: 1, runId: "2026-10-28T02-00-00Z-nuit", kind: "nuit", startedAt: "", finishedAt: "", state: "ok", migration: "0012_pannes", errors: [],
        files: [{ type: "boutique", businessId: "x", name: "X", path: "sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-x.json.gz", bytes: 1, sha256: "h", counts: {}, sameAs: "sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-x.json.gz" }],
      },
    ];
    const files = ["sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-x.json.gz", "sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-y.json.gz", "sauvegardes/2026-09-20T02-00-00Z-nuit/sommaire.json", "sauvegardes/2026-10-28T02-00-00Z-nuit/sommaire.json"];
    expect(filesToDelete(files, ["2026-09-20T02-00-00Z-nuit"], kept)).toEqual([
      "sauvegardes/2026-09-20T02-00-00Z-nuit/boutique-y.json.gz",
      "sauvegardes/2026-09-20T02-00-00Z-nuit/sommaire.json",
    ]);
  });
});

describe("copie GitHub", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  it("signale l'absence de copie depuis 48 h seulement s'il existe une nuit de plus de 48 h", () => {
    expect(githubCopyMissing([run("2026-10-29T02-00-00Z-nuit")], now)).toBe(false);
    expect(githubCopyMissing([run("2026-10-26T02-00-00Z-nuit"), run("2026-10-29T02-00-00Z-nuit")], now)).toBe(true);
    expect(githubCopyMissing([run("2026-10-26T02-00-00Z-nuit"), run("2026-10-28T02-00-00Z-nuit", "ok", "2026-10-28T03:40:00Z")], now)).toBe(false);
  });
});

describe("avant une restauration", () => {
  it("dit ce qui sera perdu ou retrouvé", () => {
    const lines = restoreImpact({ sales: 1228, products: 50, customers: 10, documents: 4 }, { sales: 1240, products: 50, customers: 12, documents: 6 });
    expect(lines.find((l) => l.key === "sales")).toEqual({ key: "sales", label: "Ventes", now: 1240, after: 1228, diff: -12 });
    expect(lines.find((l) => l.key === "products")?.diff).toBe(0);
    expect(lines.map((l) => l.key)).toEqual(["sales", "documents", "customers", "products", "purchases", "stockMovements", "customerPayments", "members"]);
  });
});
```

- [ ] **Step 2: Lancer les tests** — `npx vitest run src/lib/backup` → FAIL (modules absents).

- [ ] **Step 3: `src/lib/backup/format.ts`**

```ts
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
```

- [ ] **Step 4: `src/lib/backup/retention.ts`**

```ts
import { parseRunId, runPrefix, type Manifest, type RunState } from "./format";

const DAY = 86_400_000;

interface RunRef {
  runId: string;
  state: RunState;
  githubAt: string | null;
}

/** Passes à effacer : nuits de plus de 30 jours (sauf la 1re réussie du mois, gardée 1 an), autres passes de plus de 30 jours. */
export function runsToDelete(runs: RunRef[], now: Date): string[] {
  const parsed = runs.flatMap((r) => {
    const p = parseRunId(r.runId);
    return p ? [{ ...r, ...p }] : [];
  });
  const firstOfMonth = new Set<string>();
  const seenMonths = new Set<string>();
  for (const r of [...parsed].filter((r) => r.kind === "nuit" && r.state !== "echec").sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const month = r.date.toISOString().slice(0, 7);
    if (!seenMonths.has(month)) {
      seenMonths.add(month);
      firstOfMonth.add(r.runId);
    }
  }
  return parsed
    .filter((r) => {
      const age = now.getTime() - r.date.getTime();
      if (age < 30 * DAY) return false;
      if (r.kind === "nuit" && firstOfMonth.has(r.runId) && age < 366 * DAY) return false;
      return true;
    })
    .map((r) => r.runId);
}

/** Fichiers des passes effacées, sauf ceux qu'une passe gardée réutilise (`sameAs`). */
export function filesToDelete(files: string[], deletedRunIds: string[], keptManifests: Manifest[]): string[] {
  const used = new Set(keptManifests.flatMap((m) => m.files.map((f) => f.path)));
  const prefixes = deletedRunIds.map(runPrefix);
  return files.filter((f) => prefixes.some((p) => f.startsWith(p)) && !used.has(f));
}

/** Aucune copie GitHub depuis 48 h alors qu'une nuit de plus de 48 h existe : la copie de secours ne marche plus. */
export function githubCopyMissing(runs: RunRef[], now: Date): boolean {
  const limit = now.getTime() - 2 * DAY;
  const nights = runs.flatMap((r) => {
    const p = parseRunId(r.runId);
    return p && p.kind === "nuit" && r.state !== "echec" ? [{ ...r, date: p.date }] : [];
  });
  if (!nights.some((r) => r.date.getTime() < limit)) return false;
  return !runs.some((r) => r.githubAt && new Date(r.githubAt).getTime() >= limit);
}
```

- [ ] **Step 5: `src/lib/backup/compare.ts`**

```ts
/** Ce que l'administrateur regarde avant de restaurer une boutique. */
const WATCHED = [
  ["sales", "Ventes"],
  ["documents", "Devis et factures"],
  ["customers", "Clients"],
  ["products", "Produits"],
  ["purchases", "Entrées de stock"],
  ["stockMovements", "Mouvements de stock"],
  ["customerPayments", "Paiements de clients"],
  ["members", "Membres de l'équipe"],
] as const;

export interface ImpactLine {
  key: string;
  label: string;
  now: number;
  after: number;
  diff: number;
}

export function restoreImpact(saved: Record<string, number>, current: Record<string, number>): ImpactLine[] {
  return WATCHED.map(([key, label]) => {
    const now = current[key] ?? 0;
    const after = saved[key] ?? 0;
    return { key, label, now, after, diff: after - now };
  });
}
```

- [ ] **Step 6: Tests** — `npx vitest run src/lib/backup` → PASS.

- [ ] **Step 7: Commit** — `git add src/lib/backup && git commit -m "feat(sauvegardes): format des fichiers, conservation et comparaison avant restauration"`

---

### Task 2: Coffre, export et passes de sauvegarde

**Files:**
- Modify: `package.json` / `package-lock.json` (`@vercel/blob@2.8.2`, déjà installé), `.gitignore` (`/.sauvegardes-local/`)
- Create: `src/server/backup/store.ts`, `src/server/backup/tables.ts`, `src/server/backup/export.ts`, `src/server/backup/runs.ts`, `src/server/backup/key.ts`

**Interfaces:**
- Consumes: Task 1 ; `adminEmails()` (`src/server/admin-emails.ts`) ; tables Drizzle de `@/db/schema` ; `drizzle/meta/_journal.json`.
- Produces: `backupStore(): BackupStore` (`kind`, `put`, `get`, `list`, `del`) ; `SHOP_TABLES`, `CHILD_TABLES`, `ADMIN_TABLES`, `ADMIN_MANAGED_BUSINESS_KEYS`, `dateKeys(table)`, `userRefKeys(table)`, `reviveRow(row, keys)`, `currentMigration()` ; `exportShop(businessId)`, `exportAdmin()`, `currentShopCounts(businessId)` ; `runBackup(kind, opts)`, `readIndex()`, `readManifest(runId)`, `readPayload(path)`, `pruneBackups(now)`, `markGithubCopy(runId)`, `latestNightManifest()` ; `isBackupKeyValid(request)`.

- [ ] **Step 1: `src/server/backup/store.ts`**

```ts
import "server-only";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

/** Coffre des sauvegardes : Vercel Blob privé en ligne, dossier local sur l'ordinateur de développement. */
export interface BackupStore {
  readonly kind: "vercel" | "local";
  put(pathname: string, data: Buffer, contentType: string): Promise<void>;
  get(pathname: string): Promise<Buffer | null>;
  list(prefix: string): Promise<{ path: string; bytes: number }[]>;
  del(pathnames: string[]): Promise<void>;
}

const blobStore: BackupStore = {
  kind: "vercel",
  async put(pathname, data, contentType) {
    await put(pathname, data, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType });
  },
  async get(pathname) {
    const res = await get(pathname, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return null;
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  },
  async list(prefix) {
    const out: { path: string; bytes: number }[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      out.push(...page.blobs.map((b) => ({ path: b.pathname, bytes: b.size })));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  },
  async del(pathnames) {
    for (let i = 0; i < pathnames.length; i += 100) await del(pathnames.slice(i, i + 100));
  },
};

const LOCAL_ROOT = path.join(process.cwd(), ".sauvegardes-local");
const local = (p: string) => path.join(LOCAL_ROOT, ...p.split("/"));

const localStore: BackupStore = {
  kind: "local",
  async put(pathname, data) {
    await mkdir(path.dirname(local(pathname)), { recursive: true });
    await writeFile(local(pathname), data);
  },
  async get(pathname) {
    try {
      return await readFile(local(pathname));
    } catch {
      return null;
    }
  },
  async list(prefix) {
    const out: { path: string; bytes: number }[] = [];
    async function walk(dir: string, rel: string) {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        const full = path.join(dir, name);
        const relPath = rel ? `${rel}/${name}` : name;
        const s = await stat(full);
        if (s.isDirectory()) await walk(full, relPath);
        else if (relPath.startsWith(prefix)) out.push({ path: relPath, bytes: s.size });
      }
    }
    await walk(LOCAL_ROOT, "");
    return out;
  },
  async del(pathnames) {
    for (const p of pathnames) await rm(local(p), { force: true });
  },
};

export function backupStore(): BackupStore {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobStore;
  if (process.env.VERCEL) throw new Error("Coffre des sauvegardes non configuré (BLOB_READ_WRITE_TOKEN absent).");
  return localStore;
}
```

`.gitignore` : ajouter `/.sauvegardes-local/` sous « # captures des tests navigateur ».

- [ ] **Step 2: `src/server/backup/tables.ts`**

```ts
import "server-only";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import journal from "../../../drizzle/meta/_journal.json";
import {
  adminAuditLog, businessNotes, categories, customerPayments, customers, documentItems, documents, invitations, licensePayments,
  licenseSales, locations, members, products, purchaseItems, purchases, saleItems, sales, shopDevices, stockLevels, stockMovements,
  suppliers, user,
} from "@/db/schema";

/** Tables d'une boutique, dans l'ordre d'insertion (les tables mères d'abord ; on efface dans l'ordre inverse). */
export const SHOP_TABLES = {
  locations, categories, suppliers, customers, products, stockLevels, purchases, purchaseItems, sales, saleItems,
  customerPayments, stockMovements, documents, documentItems, members, shopDevices, invitations,
} as const;
export type ShopTableName = keyof typeof SHOP_TABLES;

/** Tables filles sans `business_id` : lues et effacées par leur table mère. */
export const CHILD_TABLES = {
  purchaseItems: { parent: purchases, parentKey: "purchases", fk: purchaseItems.purchaseId },
  saleItems: { parent: sales, parentKey: "sales", fk: saleItems.saleId },
  documentItems: { parent: documents, parentKey: "documents", fk: documentItems.documentId },
} as const;

export const ADMIN_TABLES = { licenseSales, licensePayments, businessNotes, adminAuditLog } as const;
export type AdminTableName = keyof typeof ADMIN_TABLES;

/** Ce que gère l'admin dans la ligne du commerce : gardé tel quel quand on restaure une boutique. */
export const ADMIN_MANAGED_BUSINESS_KEYS = [
  "plan", "trialEndsAt", "periodEndsAt", "suspendedAt", "isDemo", "demoResetAt", "licensePack", "licenseActivatedAt",
  "maintenanceEndsAt", "slug", "brandColor",
] as const;

/** Colonnes date (les fichiers les gardent en texte ISO). */
export function dateKeys(table: PgTable): string[] {
  return Object.entries(getTableColumns(table))
    .filter(([, c]) => c.dataType === "date")
    .map(([k]) => k);
}

/** Colonnes qui désignent un utilisateur (clé étrangère vers `user`), trouvées dans le schéma lui-même. */
export function userRefKeys(table: PgTable): string[] {
  const byDbName = new Map(Object.entries(getTableColumns(table)).map(([k, c]) => [c.name, k]));
  return getTableConfig(table).foreignKeys.flatMap((fk) => {
    const ref = fk.reference();
    return ref.foreignTable === user ? ref.columns.map((c) => byDbName.get(c.name)!).filter(Boolean) : [];
  });
}

export function reviveRow(row: Record<string, unknown>, dates: string[]): Record<string, unknown> {
  const out = { ...row };
  for (const k of dates) if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
  return out;
}

/** Dernière migration connue du code (« 0012_pannes »). */
export function currentMigration(): string {
  return journal.entries.at(-1)?.tag ?? "inconnue";
}
```

Si `getTableConfig(...).foreignKeys[n].reference()` n'expose pas `foreignTable` dans cette version de Drizzle, lire le type dans `node_modules/drizzle-orm/pg-core/foreign-keys.d.ts` et adapter (champ équivalent) avant de continuer.

- [ ] **Step 3: `src/server/backup/export.ts`**

```ts
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { account, businesses, user } from "@/db/schema";
import { BACKUP_FORMAT, countRows, sortRows, type BackupPayload } from "@/lib/backup/format";
import { adminEmails } from "../admin-emails";
import { ADMIN_TABLES, CHILD_TABLES, currentMigration, SHOP_TABLES, type ShopTableName } from "./tables";

type Rows = Record<string, unknown>[];

/** Comptes de connexion sans les jetons Google (inutiles et sensibles). */
async function accountsOf(userIds: string[]): Promise<Rows> {
  if (userIds.length === 0) return [];
  const rows = await db.select().from(account).where(inArray(account.userId, userIds));
  return rows.map((a) => ({ ...a, accessToken: null, refreshToken: null, idToken: null }));
}

async function shopTables(businessId: string): Promise<Record<ShopTableName, Rows>> {
  const out = {} as Record<ShopTableName, Rows>;
  for (const [name, table] of Object.entries(SHOP_TABLES) as [ShopTableName, PgTable & { businessId?: unknown }][]) {
    const child = CHILD_TABLES[name as keyof typeof CHILD_TABLES];
    if (child) {
      const rows = await db
        .select({ row: table })
        .from(table)
        .innerJoin(child.parent, eq(child.parent.id, child.fk))
        .where(eq(child.parent.businessId, businessId));
      out[name] = rows.map((r) => r.row as Record<string, unknown>);
    } else {
      // Toutes les tables non filles ont business_id
      const t = table as unknown as typeof SHOP_TABLES.locations;
      out[name] = (await db.select().from(t).where(eq(t.businessId, businessId))) as Rows;
    }
  }
  return out;
}

/** Tout le contenu d'une boutique (sans ce qui ne doit jamais être copié). */
export async function exportShop(businessId: string): Promise<BackupPayload> {
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (!business) throw new Error("Commerce introuvable.");
  const tables = await shopTables(businessId);
  const userIds = [...new Set([...(tables.members as { userId: string }[]).map((m) => m.userId), ...(business.ownerId ? [business.ownerId] : [])])];
  const users = userIds.length ? ((await db.select().from(user).where(inArray(user.id, userIds))) as Rows) : [];
  const all: Record<string, Rows> = { businesses: [business as Record<string, unknown>], ...tables, users, accounts: await accountsOf(userIds) };
  const sorted = Object.fromEntries(Object.entries(all).map(([k, rows]) => [k, sortRows(rows)]));
  return {
    format: BACKUP_FORMAT,
    type: "boutique",
    createdAt: new Date().toISOString(),
    migration: currentMigration(),
    businessId,
    name: business.name,
    counts: countRows(sorted),
    tables: sorted,
  };
}

/** Données de l'espace admin : licences, paiements, notes, journal, comptes des super admins. */
export async function exportAdmin(): Promise<BackupPayload> {
  const tables: Record<string, Rows> = {};
  for (const [name, table] of Object.entries(ADMIN_TABLES)) tables[name] = (await db.select().from(table as PgTable)) as Rows;
  const emails = adminEmails();
  const admins = emails.length ? ((await db.select().from(user).where(inArray(user.email, emails))) as Rows) : [];
  tables.users = admins;
  tables.accounts = await accountsOf(admins.map((u) => u.id as string));
  tables.shops = (await db
    .select({ id: businesses.id, name: businesses.name, slug: businesses.slug, licensePack: businesses.licensePack })
    .from(businesses)
    .where(eq(businesses.isDemo, false))) as Rows;
  const sorted = Object.fromEntries(Object.entries(tables).map(([k, rows]) => [k, sortRows(rows)]));
  return {
    format: BACKUP_FORMAT,
    type: "admin",
    createdAt: new Date().toISOString(),
    migration: currentMigration(),
    businessId: null,
    name: "Espace admin",
    counts: countRows(sorted),
    tables: sorted,
  };
}

/** Nombre de lignes actuelles d'une boutique (pour la fenêtre « ce qui sera perdu »). */
export async function currentShopCounts(businessId: string): Promise<Record<string, number>> {
  return countRows(await shopTables(businessId));
}

export async function listBackupBusinessIds(): Promise<string[]> {
  const rows = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.isDemo, false)));
  return rows.map((r) => r.id);
}
```

(`user.email` est en minuscules à l'inscription ; `adminEmails()` aussi.)

- [ ] **Step 4: `src/server/backup/runs.ts`**

```ts
import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  adminFilePath, BACKUP_FORMAT, BACKUP_ROOT, contentHash, INDEX_PATH, manifestPath, runIdFor, shopFilePath,
  type BackupFileEntry, type BackupPayload, type Manifest, type RunKind, type RunSummary,
} from "@/lib/backup/format";
import { filesToDelete, githubCopyMissing, runsToDelete } from "@/lib/backup/retention";
import { exportAdmin, exportShop, listBackupBusinessIds } from "./export";
import { backupStore } from "./store";
import { currentMigration } from "./tables";

const json = (v: unknown) => Buffer.from(JSON.stringify(v));

export async function readIndex(): Promise<RunSummary[]> {
  const raw = await backupStore().get(INDEX_PATH);
  if (!raw) return [];
  try {
    return JSON.parse(raw.toString("utf8")) as RunSummary[];
  } catch {
    return [];
  }
}

async function writeIndex(runs: RunSummary[]) {
  const sorted = [...runs].sort((a, b) => (a.runId < b.runId ? 1 : -1));
  await backupStore().put(INDEX_PATH, json(sorted), "application/json");
}

export async function readManifest(runId: string): Promise<Manifest | null> {
  const raw = await backupStore().get(manifestPath(runId));
  return raw ? (JSON.parse(raw.toString("utf8")) as Manifest) : null;
}

export async function readPayload(path: string): Promise<BackupPayload | null> {
  const raw = await backupStore().get(path);
  if (!raw) return null;
  const payload = JSON.parse(gunzipSync(raw).toString("utf8")) as BackupPayload;
  if (payload.format !== BACKUP_FORMAT || !payload.tables) throw new Error("Fichier de sauvegarde illisible ou d'un autre format.");
  return payload;
}

/** Dernière passe (ok ou partielle) pour réutiliser les fichiers qui n'ont pas changé. */
async function previousFiles(index: RunSummary[]): Promise<Map<string, BackupFileEntry>> {
  const last = index.find((r) => r.state !== "echec");
  const manifest = last ? await readManifest(last.runId) : null;
  return new Map((manifest?.files ?? []).map((f) => [f.businessId ?? "admin", f]));
}

/**
 * Une passe : un fichier par boutique (toutes, ou celles demandées) et le fichier admin.
 * Une boutique inchangée n'est pas recopiée : son entrée pointe vers le fichier précédent.
 */
export async function runBackup(kind: RunKind, opts: { businessIds?: string[]; admin?: boolean } = {}): Promise<Manifest> {
  const store = backupStore();
  const started = new Date();
  const runId = runIdFor(kind, started);
  const index = await readIndex();
  const previous = await previousFiles(index);
  const files: BackupFileEntry[] = [];
  const errors: Manifest["errors"] = [];
  let written = 0;

  async function save(payload: BackupPayload, path: string) {
    const sha256 = contentHash(payload.tables);
    const key = payload.businessId ?? "admin";
    const prev = previous.get(key);
    if (prev && prev.sha256 === sha256) {
      files.push({ ...prev, name: payload.name, counts: payload.counts, sameAs: prev.path });
      return;
    }
    const gz = gzipSync(json(payload));
    await store.put(path, gz, "application/gzip");
    written += gz.length;
    files.push({ type: payload.type, businessId: payload.businessId, name: payload.name, path, bytes: gz.length, sha256, counts: payload.counts, sameAs: null });
  }

  const ids = opts.businessIds ?? (await listBackupBusinessIds());
  for (const id of ids) {
    try {
      await save(await exportShop(id), shopFilePath(runId, id));
    } catch (error) {
      errors.push({ name: `boutique ${id}`, message: error instanceof Error ? error.message : String(error) });
    }
  }
  if (opts.admin ?? opts.businessIds === undefined) {
    try {
      await save(await exportAdmin(), adminFilePath(runId));
    } catch (error) {
      errors.push({ name: "admin", message: error instanceof Error ? error.message : String(error) });
    }
  }

  const manifest: Manifest = {
    format: BACKUP_FORMAT,
    runId,
    kind,
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    state: errors.length === 0 ? "ok" : files.length > 0 ? "partiel" : "echec",
    migration: currentMigration(),
    files,
    errors,
  };
  await store.put(manifestPath(runId), json(manifest), "application/json");
  await writeIndex([
    { runId, kind, state: manifest.state, startedAt: manifest.startedAt, finishedAt: manifest.finishedAt, shops: files.filter((f) => f.type === "boutique").length, bytes: written, githubAt: null },
    ...index,
  ]);
  return manifest;
}

/** Efface les passes trop anciennes (sans jamais effacer un fichier encore réutilisé). */
export async function pruneBackups(now: Date): Promise<string[]> {
  const index = await readIndex();
  const doomed = runsToDelete(index, now);
  if (doomed.length === 0) return [];
  const kept = index.filter((r) => !doomed.includes(r.runId));
  const keptManifests = (await Promise.all(kept.map((r) => readManifest(r.runId)))).filter((m): m is Manifest => m !== null);
  const all = (await backupStore().list(`${BACKUP_ROOT}/`)).map((f) => f.path);
  await backupStore().del(filesToDelete(all, doomed, keptManifests));
  await writeIndex(kept);
  return doomed;
}

export async function latestNightManifest(): Promise<Manifest | null> {
  const last = (await readIndex()).find((r) => r.kind === "nuit" && r.state !== "echec");
  return last ? readManifest(last.runId) : null;
}

export async function markGithubCopy(runId: string): Promise<boolean> {
  const index = await readIndex();
  const run = index.find((r) => r.runId === runId);
  if (!run) return false;
  run.githubAt = new Date().toISOString();
  await writeIndex(index);
  return true;
}

export async function isGithubCopyMissing(now: Date): Promise<boolean> {
  return githubCopyMissing(await readIndex(), now);
}
```

- [ ] **Step 5: `src/server/backup/key.ts`**

```ts
import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Clé des tâches automatiques (Vercel la met dans « Authorization: Bearer … », GitHub aussi). */
export function isBackupKeyValid(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

- [ ] **Step 6: Vérifier** — `npx tsc --noEmit && npx eslint src && npx vitest run`.

- [ ] **Step 7: Essai réel en local (coffre = dossier local, base de production en lecture seule)**

Script `scratchpad/backup-local.ts` lancé avec `npx tsx --conditions=react-server` depuis la racine (copie temporaire à la racine puis suppression, comme `create-test-account.ts`) : `runBackup("manuelle")` puis affiche le sommaire (boutiques, tailles, erreurs) et vérifie avec `readPayload` qu'un fichier se relit (même `counts`). Relancer : les boutiques inchangées doivent avoir `sameAs`. Effacer `.sauvegardes-local/` à la fin.

- [ ] **Step 8: Commit** — `git add package.json package-lock.json .gitignore src/server/backup && git commit -m "feat(sauvegardes): coffre, export des boutiques et de l'admin, passes et conservation"`

---

### Task 3: Restauration (boutique et admin) testée sur une copie de la base

**Files:**
- Create: `src/server/backup/restore.ts`
- Modify: `src/lib/domain/admin.ts` (`ADMIN_ACTIONS` : `restore: "Restauration"`, `backup: "Sauvegarde"`)

**Interfaces:**
- Consumes: Task 2 (`SHOP_TABLES`, `CHILD_TABLES`, `ADMIN_TABLES`, `ADMIN_MANAGED_BUSINESS_KEYS`, `dateKeys`, `userRefKeys`, `reviveRow`, `currentMigration`), `logAdmin` (`src/server/services/admin-audit.ts`), `migrationNumber` (Task 1).
- Produces: `restoreShopPayload(payload, ctx)`, `restoreAdminPayload(payload, ctx)`, `restoreUsers(tx, payload)`.

- [ ] **Step 1: `src/server/backup/restore.ts`**

```ts
import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, type Tx } from "@/db";
import { account, businesses, sales, user } from "@/db/schema";
import { migrationNumber, type BackupPayload } from "@/lib/backup/format";
import type { AppContext } from "../context";
import { logAdmin } from "../services/admin-audit";
import { ADMIN_MANAGED_BUSINESS_KEYS, ADMIN_TABLES, CHILD_TABLES, currentMigration, dateKeys, reviveRow, SHOP_TABLES, userRefKeys } from "./tables";

type Row = Record<string, unknown>;
const CHUNK = 400;

function assertCompatible(payload: BackupPayload) {
  if (migrationNumber(payload.migration) > migrationNumber(currentMigration())) {
    throw new Error("Cette sauvegarde vient d'une version plus récente de Sama Stock : mettez d'abord le site à jour.");
  }
}

async function insertRows(tx: Tx, table: PgTable, rows: Row[], knownUsers: Set<string>) {
  if (rows.length === 0) return;
  const dates = dateKeys(table);
  const userKeys = userRefKeys(table);
  const prepared = rows.map((r) => {
    const row = reviveRow(r, dates);
    for (const k of userKeys) if (typeof row[k] === "string" && !knownUsers.has(row[k] as string)) row[k] = null;
    return row;
  });
  for (let i = 0; i < prepared.length; i += CHUNK) await tx.insert(table).values(prepared.slice(i, i + CHUNK) as never);
}

/** Recrée les utilisateurs absents (et leurs comptes) ; un utilisateur existant n'est jamais modifié. */
export async function restoreUsers(tx: Tx, payload: BackupPayload): Promise<Set<string>> {
  const users = (payload.tables.users ?? []) as Row[];
  const ids = users.map((u) => u.id as string);
  const existing = ids.length ? new Set((await tx.select({ id: user.id }).from(user).where(inArray(user.id, ids))).map((u) => u.id)) : new Set<string>();
  const missing = users.filter((u) => !existing.has(u.id as string));
  if (missing.length) {
    const created = await tx
      .insert(user)
      .values(missing.map((u) => reviveRow(u, dateKeys(user))) as never)
      .onConflictDoNothing()
      .returning({ id: user.id });
    const createdIds = new Set(created.map((c) => c.id));
    const accounts = ((payload.tables.accounts ?? []) as Row[]).filter((a) => createdIds.has(a.userId as string));
    if (accounts.length) await tx.insert(account).values(accounts.map((a) => reviveRow(a, dateKeys(account))) as never).onConflictDoNothing();
  }
  const all = ids.length ? await tx.select({ id: user.id }).from(user).where(inArray(user.id, ids)) : [];
  return new Set(all.map((u) => u.id));
}

/** Remet une boutique dans l'état du fichier, sans toucher aux autres boutiques ni aux licences. */
export async function restoreShopPayload(payload: BackupPayload, ctx: AppContext): Promise<void> {
  if (payload.type !== "boutique" || !payload.businessId) throw new Error("Ce fichier n'est pas la sauvegarde d'une boutique.");
  assertCompatible(payload);
  const businessId = payload.businessId;
  const saved = payload.tables.businesses?.[0];
  if (!saved) throw new Error("Fichier incomplet : la fiche du commerce manque.");

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`sama-stock-restore:${businessId}`}))`);
    const [current] = await tx.select().from(businesses).where(eq(businesses.id, businessId)).for("update");

    // 1. Effacer le contenu actuel : tables filles, puis les autres dans l'ordre inverse
    const names = Object.keys(SHOP_TABLES) as (keyof typeof SHOP_TABLES)[];
    for (const name of [...names].reverse()) {
      const child = CHILD_TABLES[name as keyof typeof CHILD_TABLES];
      if (child) {
        const parentIds = tx.select({ id: child.parent.id }).from(child.parent).where(eq(child.parent.businessId, businessId));
        await tx.delete(SHOP_TABLES[name]).where(inArray(child.fk, parentIds));
      } else {
        const t = SHOP_TABLES[name] as unknown as typeof SHOP_TABLES.locations;
        await tx.delete(t).where(eq(t.businessId, businessId));
      }
    }

    // 2. Utilisateurs absents recréés
    const knownUsers = await restoreUsers(tx, payload);

    // 3. Fiche du commerce : contenu de la sauvegarde, réglages de l'admin actuels, compteurs jamais en arrière
    const row = reviveRow(saved, dateKeys(businesses));
    if (typeof row.ownerId === "string" && !knownUsers.has(row.ownerId)) row.ownerId = null;
    if (current) {
      const update: Row = { ...row };
      delete update.id;
      for (const k of ADMIN_MANAGED_BUSINESS_KEYS) update[k] = current[k];
      update.saleCounter = Math.max(Number(current.saleCounter), Number(row.saleCounter ?? 0));
      update.orderCounter = Math.max(Number(current.orderCounter), Number(row.orderCounter ?? 0));
      await tx.update(businesses).set(update as never).where(eq(businesses.id, businessId));
    } else {
      await tx.insert(businesses).values(row as never);
    }

    // 4. Contenu, tables mères d'abord ; « vente corrigée » reliée après coup
    const replaces: { id: string; replacesId: string }[] = [];
    for (const name of names) {
      let rows = (payload.tables[name] ?? []) as Row[];
      if (name === "sales") {
        rows = rows.map((r) => {
          if (typeof r.replacesId === "string") replaces.push({ id: r.id as string, replacesId: r.replacesId });
          return { ...r, replacesId: null };
        });
      }
      await insertRows(tx, SHOP_TABLES[name], rows, knownUsers);
    }
    for (const r of replaces) await tx.update(sales).set({ replacesId: r.replacesId }).where(eq(sales.id, r.id));

    await logAdmin(tx, ctx, { action: "restore", businessId, summary: `Boutique « ${payload.name} » remise à l'état du ${payload.createdAt.slice(0, 10)}` });
  });
}

/** Remet licences, paiements, notes et journal dans l'état du fichier admin. */
export async function restoreAdminPayload(payload: BackupPayload, ctx: AppContext): Promise<void> {
  if (payload.type !== "admin") throw new Error("Ce fichier n'est pas la sauvegarde de l'espace admin.");
  assertCompatible(payload);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('sama-stock-restore:admin'))`);
    const knownUsers = await restoreUsers(tx, payload);
    const shops = new Set((await tx.select({ id: businesses.id }).from(businesses)).map((b) => b.id));
    const { licensePayments, licenseSales, businessNotes, adminAuditLog } = ADMIN_TABLES;
    await tx.delete(licensePayments);
    await tx.delete(licenseSales);
    await tx.delete(businessNotes);
    await tx.delete(adminAuditLog);
    const ofKnownShop = (rows: Row[]) => rows.filter((r) => shops.has(r.businessId as string));
    await insertRows(tx, licenseSales, ofKnownShop((payload.tables.licenseSales ?? []) as Row[]), knownUsers);
    await insertRows(tx, licensePayments, ofKnownShop((payload.tables.licensePayments ?? []) as Row[]), knownUsers);
    await insertRows(tx, businessNotes, ofKnownShop((payload.tables.businessNotes ?? []) as Row[]), knownUsers);
    const journal = ((payload.tables.adminAuditLog ?? []) as Row[]).map((r) => (r.businessId && !shops.has(r.businessId as string) ? { ...r, businessId: null } : r));
    await insertRows(tx, adminAuditLog, journal, knownUsers);
    await logAdmin(tx, ctx, { action: "restore", summary: `Données admin remises à l'état du ${payload.createdAt.slice(0, 10)}` });
  });
}
```

Notes pour l'exécutant :
- `tx.delete(...).where(inArray(child.fk, sousRequête))` : Drizzle accepte une sous-requête dans `inArray`. Sinon, lire les identifiants d'abord.
- `adminAuditLog.targetUserId` n'est pas une clé étrangère : rien à faire.
- `licensePayments` dépend de `licenseSales` : on efface les paiements d'abord, on insère les ventes d'abord (déjà l'ordre ci-dessus).

- [ ] **Step 2: `ADMIN_ACTIONS`** (`src/lib/domain/admin.ts`) : ajouter `restore: "Restauration",` et `backup: "Sauvegarde",` après `info`.

- [ ] **Step 3: Branche Neon temporaire** (copie de la base, jamais la vraie) : outil Neon `create_branch` (projet `lucky-term-12839013`, nom `essai-restauration-<date>`), récupérer sa chaîne de connexion (`get_connection_string`, sans l'afficher : l'écrire dans un fichier du scratchpad).

- [ ] **Step 4: Essai de bout en bout sur la branche** — script `scratchpad/restore-e2e.ts` (même méthode que l'étape 7 de la tâche 2, avec `DATABASE_URL` = branche, coffre local) :
  1. `exportShop(<Boutique Test>)` → `before` ;
  2. sur la branche : supprimer 3 ventes, modifier le nom d'un produit, ajouter un client ;
  3. `restoreShopPayload(before, ctxAdmin)` (ctx minimal avec un vrai `user.id` admin de la branche) ;
  4. `exportShop` → `after` ; vérifier `contentHash(after.tables sans members.notificationsSeenAt / shopDevices.lastSeenAt)` == celui de `before`, et que `licensePack`, `slug` n'ont pas bougé ; vérifier qu'une **autre** boutique a le même contenu qu'avant (empreinte) ;
  5. `exportAdmin` → modifier une note → `restoreAdminPayload` → vérifier.
  Le script affiche « OK » ou l'écart exact.

- [ ] **Step 5: Supprimer la branche Neon** (`delete_branch`) et le fichier de connexion.

- [ ] **Step 6: Vérifier et commit** — `npx tsc --noEmit && npx eslint src && npx vitest run` ; `git add src/server/backup/restore.ts src/lib/domain/admin.ts && git commit -m "feat(sauvegardes): restaurer une boutique ou les données admin, sans toucher au reste"`

---

### Task 4: Routes automatiques, tâche de nuit et copie GitHub

**Files:**
- Create: `src/app/api/sauvegardes/nuit/route.ts`, `src/app/api/sauvegardes/derniere/route.ts`, `src/app/api/sauvegardes/fichier/route.ts`, `src/app/api/sauvegardes/github-ok/route.ts`
- Create: `.github/workflows/sauvegarde.yml`
- Modify: `vercel.json` (`crons`)

**Interfaces:**
- Consumes: Task 2 (`runBackup`, `pruneBackups`, `isGithubCopyMissing`, `latestNightManifest`, `markGithubCopy`, `backupStore`, `isBackupKeyValid`), Task 1 (`isBackupPath`), `reportError` (pannes).

- [ ] **Step 1: `src/app/api/sauvegardes/nuit/route.ts`**

```ts
import { NextResponse } from "next/server";
import { isBackupKeyValid } from "@/server/backup/key";
import { isGithubCopyMissing, pruneBackups, runBackup } from "@/server/backup/runs";
import { reportError } from "@/server/services/app-errors";

export const maxDuration = 300;

/** Sauvegarde de la nuit (tâche planifiée Vercel, 2 h à Dakar). */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const now = new Date();
  try {
    const manifest = await runBackup("nuit");
    if (manifest.state !== "ok") {
      await reportError({ source: "sauvegarde", route: "/api/sauvegardes/nuit", message: `Sauvegarde ${manifest.state === "echec" ? "ratée" : "incomplète"} : ${manifest.errors.map((e) => `${e.name} (${e.message})`).join(", ")}` });
    }
    const deleted = await pruneBackups(now);
    if (await isGithubCopyMissing(now)) {
      await reportError({ source: "sauvegarde", route: "/api/sauvegardes/nuit", message: "Aucune copie de secours GitHub depuis 2 jours" });
    }
    return NextResponse.json({ runId: manifest.runId, state: manifest.state, files: manifest.files.length, deleted: deleted.length });
  } catch (error) {
    await reportError({ source: "sauvegarde", route: "/api/sauvegardes/nuit", message: `Sauvegarde ratée : ${error instanceof Error ? error.message : String(error)}` });
    return NextResponse.json({ error: "Sauvegarde ratée" }, { status: 500 });
  }
}
```

- [ ] **Step 2: les trois routes de la copie GitHub**

`derniere/route.ts` :

```ts
import { NextResponse } from "next/server";
import { isBackupKeyValid } from "@/server/backup/key";
import { latestNightManifest } from "@/server/backup/runs";

/** Sommaire de la dernière sauvegarde de nuit réussie (copie de secours GitHub). */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const manifest = await latestNightManifest();
  return manifest ? NextResponse.json(manifest) : NextResponse.json({ error: "Aucune sauvegarde" }, { status: 404 });
}
```

`fichier/route.ts` :

```ts
import { NextResponse } from "next/server";
import { isBackupPath } from "@/lib/backup/format";
import { isBackupKeyValid } from "@/server/backup/key";
import { backupStore } from "@/server/backup/store";

/** Un fichier du coffre, pour la copie de secours GitHub. */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const path = new URL(request.url).searchParams.get("chemin") ?? "";
  if (!isBackupPath(path)) return new NextResponse(null, { status: 400 });
  const data = await backupStore().get(path);
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": "application/gzip", "Cache-Control": "no-store" } });
}
```

`github-ok/route.ts` :

```ts
import { NextResponse } from "next/server";
import { parseRunId } from "@/lib/backup/format";
import { isBackupKeyValid } from "@/server/backup/key";
import { markGithubCopy } from "@/server/backup/runs";

/** GitHub a fini de copier cette passe. */
export async function POST(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const runId = new URL(request.url).searchParams.get("passe") ?? "";
  if (!parseRunId(runId)) return new NextResponse(null, { status: 400 });
  return (await markGithubCopy(runId)) ? new NextResponse(null, { status: 204 }) : new NextResponse(null, { status: 404 });
}
```

- [ ] **Step 3: `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "crons": [{ "path": "/api/sauvegardes/nuit", "schedule": "0 2 * * *" }]
}
```

- [ ] **Step 4: `.github/workflows/sauvegarde.yml`**

```yaml
# Copie de secours des sauvegardes de Sama Stock, chaque nuit, gardée 30 jours dans GitHub.
# Réglages (Settings › Secrets and variables › Actions) : secret SAUVEGARDE_CLE (= CRON_SECRET de Vercel),
# variable SITE_URL facultative (adresse du site, par défaut https://sama-stock-one.vercel.app).
name: Sauvegarde de secours

on:
  schedule:
    - cron: "30 3 * * *"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  copie:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      SITE: ${{ vars.SITE_URL || 'https://sama-stock-one.vercel.app' }}
      CLE: ${{ secrets.SAUVEGARDE_CLE }}
    steps:
      - name: Télécharger la dernière sauvegarde
        run: |
          set -euo pipefail
          mkdir -p sauvegarde
          curl -fsS -H "Authorization: Bearer $CLE" "$SITE/api/sauvegardes/derniere" -o sauvegarde/sommaire.json
          PASSE=$(jq -r .runId sauvegarde/sommaire.json)
          echo "PASSE=$PASSE" >> "$GITHUB_ENV"
          jq -r '.files[].path' sauvegarde/sommaire.json | sort -u | while read -r CHEMIN; do
            curl -fsS -G -H "Authorization: Bearer $CLE" --data-urlencode "chemin=$CHEMIN" "$SITE/api/sauvegardes/fichier" -o "sauvegarde/$(basename "$CHEMIN")"
          done
          ls -l sauvegarde
      - name: Garder la copie 30 jours
        uses: actions/upload-artifact@v4
        with:
          name: sauvegarde-${{ env.PASSE }}
          path: sauvegarde/
          retention-days: 30
      - name: Prévenir le site que la copie est faite
        run: curl -fsS -X POST -H "Authorization: Bearer $CLE" "$SITE/api/sauvegardes/github-ok?passe=$PASSE"
```

- [ ] **Step 5: Essai local des routes** (coffre local, `CRON_SECRET` de `.env`) : `next start` sans `VERCEL` ; `curl` sans clé → 401 ; avec clé : `/api/sauvegardes/nuit` → JSON `state: ok` ; `/derniere` → sommaire ; `/fichier?chemin=...` → fichier gzip qui se décompresse ; `/fichier?chemin=sauvegardes/../.env` → 400 ; `/github-ok?passe=…` → 204. Puis effacer `.sauvegardes-local/`. **Attention** : `/nuit` lit la base de production (lecture seule) ; ne lance pas de restauration.

- [ ] **Step 6: Clé `CRON_SECRET`** : script `scratchpad/cron-secret.cjs` qui ajoute à `.env` `CRON_SECRET=<48 caractères aléatoires>` s'il n'existe pas, **sans l'afficher**.

- [ ] **Step 7: Commit** — `git add src/app/api/sauvegardes vercel.json .github/workflows/sauvegarde.yml && git commit -m "feat(sauvegardes): sauvegarde de chaque nuit et copie de secours GitHub"`

---

### Task 5: Page Admin › Sauvegardes

**Files:**
- Create: `src/server/actions/backups.ts`, `src/app/api/admin/sauvegardes/fichier/route.ts`, `src/app/api/admin/sauvegardes/envoi/route.ts`
- Create: `src/app/admin/sauvegardes/page.tsx`, `src/components/admin/backups/run-list.tsx`, `src/components/admin/backups/restore-dialog.tsx`, `src/components/admin/backups/backup-now.tsx`, `src/components/admin/backups/upload-restore.tsx`
- Modify: `src/components/admin/admin-nav.ts` (rubrique « Sauvegardes », icône `system` déjà prise → ajouter l'icône `backup` : `NavIcon` dans `src/components/shell/nav.ts` + `DatabaseBackup` dans `src/components/shell/nav-icon.tsx`)

**Interfaces:**
- Consumes: Tasks 1–3, `requireSuperAdminAction`, `getContext` (`src/server/context.ts`), `runAction`/`parse`, `logAdmin`.
- Produces: actions `backupNow()`, `getRunFiles(runId)`, `previewShopRestore({ path })`, `restoreShop({ path, confirmName })`, `restoreAdmin({ path, confirm })`.

- [ ] **Step 1: `src/server/actions/backups.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { isBackupPath, parseRunId } from "@/lib/backup/format";
import { restoreImpact } from "@/lib/backup/compare";
import { ActionError, parse, runAction } from "../action";
import { requireSuperAdminAction } from "../context";
import { currentShopCounts } from "../backup/export";
import { restoreAdminPayload, restoreShopPayload } from "../backup/restore";
import { readManifest, readPayload, runBackup } from "../backup/runs";
import { logAdmin } from "../services/admin-audit";

const pathSchema = z.string().refine(isBackupPath, "Fichier de sauvegarde inconnu.");

async function payloadAt(path: string) {
  const payload = await readPayload(path);
  if (!payload) throw new ActionError("Fichier de sauvegarde introuvable.");
  return payload;
}

export async function backupNow() {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const manifest = await runBackup("manuelle");
    await logAdmin(db, ctx, { action: "backup", summary: `Sauvegarde manuelle (${manifest.files.length} fichiers, ${manifest.state})` });
    revalidatePath("/admin/sauvegardes");
    return { state: manifest.state, files: manifest.files.length, errors: manifest.errors.length };
  });
}

/** Fichiers d'une passe (dépliée dans la liste). */
export async function getRunFiles(runId: string) {
  return runAction(async () => {
    await requireSuperAdminAction();
    if (!parseRunId(runId)) throw new ActionError("Sauvegarde inconnue.");
    const manifest = await readManifest(runId);
    if (!manifest) throw new ActionError("Sommaire introuvable.");
    return manifest.files.map((f) => ({ type: f.type, businessId: f.businessId, name: f.name, path: f.path, bytes: f.bytes, counts: f.counts, reused: f.sameAs !== null }));
  });
}

/** Ce que la restauration changerait (fenêtre de confirmation). */
export async function previewShopRestore(input: { path: string }) {
  return runAction(async () => {
    await requireSuperAdminAction();
    const payload = await payloadAt(parse(pathSchema, input.path));
    if (payload.type !== "boutique" || !payload.businessId) throw new ActionError("Ce fichier n'est pas la sauvegarde d'une boutique.");
    return { name: payload.name, savedAt: payload.createdAt, lines: restoreImpact(payload.counts, await currentShopCounts(payload.businessId)) };
  });
}

export async function restoreShop(input: { path: string; confirmName: string }) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    const payload = await payloadAt(parse(pathSchema, input.path));
    if (payload.type !== "boutique" || !payload.businessId) throw new ActionError("Ce fichier n'est pas la sauvegarde d'une boutique.");
    if (input.confirmName.trim().toLowerCase() !== payload.name.trim().toLowerCase()) throw new ActionError("Retapez exactement le nom de la boutique pour confirmer.");
    const safety = await runBackup("avant-restauration", { businessIds: [payload.businessId], admin: false });
    if (safety.state !== "ok") throw new ActionError("La copie de sécurité d'avant restauration a échoué : rien n'a été changé.");
    await restoreShopPayload(payload, ctx);
    revalidatePath("/admin", "layout");
    return { safetyRun: safety.runId };
  });
}

export async function restoreAdmin(input: { path: string; confirm: string }) {
  return runAction(async () => {
    const ctx = await requireSuperAdminAction();
    if (input.confirm.trim().toUpperCase() !== "ADMIN") throw new ActionError("Tapez ADMIN pour confirmer.");
    const payload = await payloadAt(parse(pathSchema, input.path));
    const safety = await runBackup("avant-restauration", { businessIds: [], admin: true });
    if (safety.state !== "ok") throw new ActionError("La copie de sécurité d'avant restauration a échoué : rien n'a été changé.");
    await restoreAdminPayload(payload, ctx);
    revalidatePath("/admin", "layout");
    return { safetyRun: safety.runId };
  });
}
```

- [ ] **Step 2: téléchargement et envoi de fichier (super admin)**

`src/app/api/admin/sauvegardes/fichier/route.ts` :

```ts
import { NextResponse } from "next/server";
import { isBackupPath } from "@/lib/backup/format";
import { backupStore } from "@/server/backup/store";
import { getContext } from "@/server/context";

/** Télécharger un fichier de sauvegarde (super admin). */
export async function GET(request: Request) {
  const ctx = await getContext();
  if (!ctx?.isSuperAdmin) return new NextResponse(null, { status: 403 });
  const path = new URL(request.url).searchParams.get("chemin") ?? "";
  if (!isBackupPath(path)) return new NextResponse(null, { status: 400 });
  const data = await backupStore().get(path);
  if (!data) return new NextResponse(null, { status: 404 });
  const name = path.split("/").slice(-2).join("_");
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
```

`src/app/api/admin/sauvegardes/envoi/route.ts` (envoi direct du navigateur vers le coffre, pour une copie GitHub) :

```ts
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getContext } from "@/server/context";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const ctx = await getContext();
        if (!ctx?.isSuperAdmin) throw new Error("Réservé aux administrateurs.");
        if (!/^sauvegardes\/importes\/[A-Za-z0-9_.-]+\.json\.gz$/.test(pathname)) throw new Error("Nom de fichier refusé.");
        return { allowedContentTypes: ["application/gzip", "application/x-gzip", "application/octet-stream"], maximumSizeInBytes: 50 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi refusé." }, { status: 400 });
  }
}
```

Vérifier dans `node_modules/@vercel/blob/dist/client.d.ts` la signature exacte de `handleUpload` / `onBeforeGenerateToken` (paramètres, champ `access` éventuel) et l'appel navigateur `upload(pathname, file, { access: "private", handleUploadUrl })` avant d'écrire.

- [ ] **Step 3: composants**

`backup-now.tsx` : bouton « Sauvegarder maintenant » (`useTransition`, `backupNow()`, toast « Sauvegarde faite : N fichiers » ou erreur).

`run-list.tsx` : reçoit `runs: RunSummary[]` ; chaque passe = ligne (date en heure de Dakar via `formatDateTime`, type « Nuit / Manuelle / Avant restauration », état ✓ / partielle / ratée, nombre de boutiques, taille écrite, « copie GitHub ✓ » si `githubAt`) ; « Voir » déplie : `getRunFiles(runId)` → pour chaque fichier : nom, taille, ventes / produits / clients (`counts`), « identique à la veille » si `reused`, lien **Télécharger** (`/api/admin/sauvegardes/fichier?chemin=…`), bouton **Restaurer** (ouvre `RestoreDialog`).

`restore-dialog.tsx` : `Dialog` ; boutique : appelle `previewShopRestore`, affiche le tableau `lines` (Aujourd'hui / Après / écart en rouge si négatif), le texte « Les factures émises depuis seront effacées et leurs numéros pourront être redonnés. Une copie de l'état actuel est faite juste avant. », un champ « Retapez le nom de la boutique » ; bouton rouge « Restaurer » actif seulement si le nom correspond ; admin : champ « Tapez ADMIN ». Après succès : toast « Restaurée. Copie d'avant : <passe> », fermeture, `router.refresh()`.

`upload-restore.tsx` : visible seulement si le coffre est Vercel (`store === "vercel"`) : choix d'un fichier `.json.gz` → `upload("sauvegardes/importes/" + nom nettoyé, file, { access: "private", handleUploadUrl: "/api/admin/sauvegardes/envoi" })` → ouvre `RestoreDialog` sur `blob.pathname` (type deviné par le nom : `admin*.json.gz` → admin, sinon boutique).

- [ ] **Step 4: page `src/app/admin/sauvegardes/page.tsx`**

```tsx
import type { Metadata } from "next";
import { BackupNow } from "@/components/admin/backups/backup-now";
import { RunList } from "@/components/admin/backups/run-list";
import { UploadRestore } from "@/components/admin/backups/upload-restore";
import { PageHeader } from "@/components/shared/page-header";
import { readIndex } from "@/server/backup/runs";
import { backupStore } from "@/server/backup/store";

export const metadata: Metadata = { title: "Sauvegardes" };
// Les actions de la page (sauvegarde, restauration) peuvent prendre du temps
export const maxDuration = 300;

export default async function AdminBackupsPage() {
  let store: "vercel" | "local" | null = null;
  try {
    store = backupStore().kind;
  } catch {
    store = null;
  }
  const runs = store ? await readIndex() : [];
  const last = runs[0];
  const github = runs.find((r) => r.githubAt);
  const totalBytes = runs.reduce((s, r) => s + r.bytes, 0);
  return (
    <>
      <PageHeader
        title="Sauvegardes"
        description="Une sauvegarde complète chaque nuit (une par boutique, une pour l'admin), gardée 30 jours et une par mois pendant un an. Copie de secours chez GitHub."
        actions={store ? <BackupNow /> : undefined}
      />
      {!store ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Le coffre des sauvegardes n&apos;est pas encore créé dans Vercel (Storage › Blob, accès privé).
        </p>
      ) : (
        <div className="space-y-6">
          {/* trois cartes : dernière sauvegarde, copie GitHub, place utilisée — formatDateTime / taille en Mo */}
          <RunList runs={runs} />
          {store === "vercel" && <UploadRestore />}
        </div>
      )}
    </>
  );
}
```

(Les trois cartes reprennent `AdminStat` ou un simple `Card` : « Dernière sauvegarde » = `last` (date, état), « Copie GitHub » = `github?.githubAt` ou « jamais », « Place utilisée » = `totalBytes` en Mo.)

- [ ] **Step 5: menu** — `NavIcon` : ajouter `"backup"` ; `nav-icon.tsx` : `backup: DatabaseBackup` ; `ADMIN_NAV` : `{ href: "/admin/sauvegardes", label: "Sauvegardes", icon: "backup", group: "admin" }` avant « Pannes ».

- [ ] **Step 6: Vérifier** — `npx tsc --noEmit && npx eslint src && npx vitest run && npm run build`.

- [ ] **Step 7: Essai navigateur en local** (coffre local, démo Pro en admin : `ADMIN_EMAILS="demo-pro@sama-stock.invalid" npx next start`) : la page s'affiche ; « Sauvegarder maintenant » → une passe « Manuelle » apparaît ; « Voir » → fichiers, « Télécharger » renvoie un fichier ; « Restaurer » → la fenêtre affiche le tableau et refuse sans le bon nom. **Ne pas confirmer une restauration ici** (base de production) : la restauration a été vérifiée sur la branche Neon (Task 3). Effacer `.sauvegardes-local/`.

- [ ] **Step 8: Commit** — `git add src/server/actions/backups.ts src/app/api/admin/sauvegardes src/app/admin/sauvegardes src/components/admin/backups src/components/admin/admin-nav.ts src/components/shell && git commit -m "feat(sauvegardes): page Admin › Sauvegardes (voir, télécharger, restaurer une boutique ou l'admin)"`

---

### Task 6: Restauration totale et marche à suivre

**Files:**
- Create: `scripts/restaurer-tout.ts`, `docs/sauvegardes.md`

- [ ] **Step 1: `scripts/restaurer-tout.ts`**

```ts
/**
 * Restauration totale (catastrophe) : remet toutes les boutiques et l'admin depuis une passe.
 * Usage : DATABASE_URL=<nouvelle base, migrations appliquées> npx tsx --conditions=react-server scripts/restaurer-tout.ts <dossier>
 * <dossier> = copie GitHub décompressée (sommaire.json + fichiers .json.gz).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import type { BackupPayload, Manifest } from "../src/lib/backup/format";
import { restoreAdminPayload, restoreShopPayload, restoreUsers } from "../src/server/backup/restore";
import type { AppContext } from "../src/server/context";

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Indiquez le dossier de la sauvegarde.");
  const manifest = JSON.parse(await readFile(path.join(dir, "sommaire.json"), "utf8")) as Manifest;
  const load = async (p: string) => JSON.parse(gunzipSync(await readFile(path.join(dir, path.basename(p)))).toString("utf8")) as BackupPayload;
  const adminEntry = manifest.files.find((f) => f.type === "admin");
  if (!adminEntry) throw new Error("Le fichier admin manque dans cette sauvegarde.");
  const adminPayload = await load(adminEntry.path);
  // 1. Comptes des super admins, pour signer le journal
  await db.transaction((tx) => restoreUsers(tx, adminPayload).then(() => undefined));
  const adminUser = (adminPayload.tables.users ?? [])[0] as { id: string; name: string; email: string } | undefined;
  if (!adminUser) throw new Error("Aucun compte super admin dans la sauvegarde.");
  const [u] = await db.select().from(user).where(eq(user.id, adminUser.id));
  const ctx = { user: { id: u!.id, name: u!.name, email: u!.email, image: null }, isSuperAdmin: true, memberships: [], business: null } as AppContext;
  // 2. Chaque boutique, puis 3. les données admin
  for (const f of manifest.files.filter((f) => f.type === "boutique")) {
    await restoreShopPayload(await load(f.path), ctx);
    console.log(`✓ ${f.name}`);
  }
  await restoreAdminPayload(adminPayload, ctx);
  console.log("✓ Espace admin — restauration terminée");
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 2: `docs/sauvegardes.md`** — en français simple : ce qui est sauvegardé, où, combien de temps ; restaurer une boutique (Admin › Sauvegardes) ; retour à la seconde des 6 dernières heures (Neon › Branches › Restore, par le développeur) ; catastrophe : (1) nouvelle base Neon, (2) `DATABASE_URL` vers elle + `npx drizzle-kit migrate`, (3) télécharger l'artefact GitHub « sauvegarde-… » ou les fichiers du coffre, (4) `npx tsx --conditions=react-server scripts/restaurer-tout.ts <dossier>`, (5) mettre la nouvelle `DATABASE_URL` dans Vercel, redéployer.

- [ ] **Step 3: Essai du script sur une branche Neon vide** : créer une branche, y vider les tables du schéma `public` (ou partir d'une branche sans données si possible), appliquer les migrations, lancer le script sur un dossier produit par la tâche 2 (coffre local) ; comparer les `counts` ; supprimer la branche.

- [ ] **Step 4: Commit** — `git add scripts/restaurer-tout.ts docs/sauvegardes.md && git commit -m "docs(sauvegardes): restauration totale et marche à suivre"`

---

### Task 7: Mise en service avec l'utilisateur

- [ ] **Step 1:** Guider l'utilisateur : Vercel › Storage › Create › Blob, nom `sama-stock-sauvegardes`, accès **Private**, relié au projet `sama-stock` (Production) → `BLOB_READ_WRITE_TOKEN` ajouté par Vercel.
- [ ] **Step 2:** Guider : copier `CRON_SECRET` (dans `.env`, ligne `CRON_SECRET=`) dans Vercel (Production) et dans GitHub › Settings › Secrets and variables › Actions › New repository secret `SAUVEGARDE_CLE`.
- [ ] **Step 3:** L'utilisateur tape `! git push origin master` ; vérifier le déploiement (READY, `vercel crons ls` montre `/api/sauvegardes/nuit`).
- [ ] **Step 4:** Lancer une première passe en ligne (bouton « Sauvegarder maintenant » par l'utilisateur, ou `vercel crons run /api/sauvegardes/nuit` avec son accord), puis le workflow GitHub à la main (`gh workflow run sauvegarde.yml`, avec son accord) ; vérifier « copie GitHub ✓ » sur la page.
- [ ] **Step 5:** Mettre à jour la mémoire du projet.

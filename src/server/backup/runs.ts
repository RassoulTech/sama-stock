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

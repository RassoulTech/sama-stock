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

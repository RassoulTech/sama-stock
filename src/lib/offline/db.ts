import type { OfflineSnapshot, OutboxSale } from "./types";

const DB_NAME = "sama-stock";
const DB_VERSION = 1;
type StoreName = "snapshot" | "outbox" | "meta";

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshot")) db.createObjectStore("snapshot");
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "clientRef" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

/** Une transaction sur un magasin : résout avec le résultat de la requête quand tout est bien écrit. */
function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

/** Données gardées par le téléphone pour la caisse hors ligne. */
export const offlineDb = {
  getSnapshot: async () => (await run<OfflineSnapshot>("snapshot", "readonly", (s) => s.get("current"))) ?? null,
  saveSnapshot: async (snapshot: OfflineSnapshot) => {
    await run("snapshot", "readwrite", (s) => s.put(snapshot, "current"));
  },
  clearSnapshot: async () => {
    await run("snapshot", "readwrite", (s) => s.delete("current"));
  },
  listOutbox: async () => (await run<OutboxSale[]>("outbox", "readonly", (s) => s.getAll())) ?? [],
  putOutbox: async (sale: OutboxSale) => {
    await run("outbox", "readwrite", (s) => s.put(sale));
  },
  deleteOutbox: async (clientRef: string) => {
    await run("outbox", "readwrite", (s) => s.delete(clientRef));
  },
  /** Numéro provisoire suivant (« Hors ligne n° 3 »), propre au téléphone. */
  nextLocalNumber: async () => {
    const db = await openDb();
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction("meta", "readwrite");
      const store = tx.objectStore("meta");
      let next = 1;
      const req = store.get("localCounter");
      req.onsuccess = () => {
        next = (Number(req.result) || 0) + 1;
        store.put(next, "localCounter");
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(tx.error);
    });
  },
};

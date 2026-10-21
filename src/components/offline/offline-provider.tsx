"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { offlineDb } from "@/lib/offline/db";
import { applySyncResults, outboxSummary, sentToPurge } from "@/lib/offline/outbox";
import { buildOutboxSale } from "@/lib/offline/sale";
import { MAX_SYNC_BATCH, OFFLINE_SYNC_VERSION, offlineSaleInputSchema, toSyncInput } from "@/lib/offline/schema";
import type { OfflineIdentity, OfflineSnapshot, OutboxSale, SaleDraft, SyncResult } from "@/lib/offline/types";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
/** Copie rafraîchie au plus toutes les 2 minutes (sauf après une vente). */
const SNAPSHOT_MAX_AGE_MS = 2 * 60 * 1000;
const RETRY_EVERY_MS = 30 * 1000;
const JUST_SENT_MS = 5000;

export interface OfflineState {
  ready: boolean;
  online: boolean;
  identity: OfflineIdentity | null;
  snapshot: OfflineSnapshot | null;
  outbox: OutboxSale[];
  summary: { pending: number; refused: number; sent: number };
  sessionExpired: boolean;
  justSent: number;
  enqueueSale: (draft: SaleDraft) => Promise<OutboxSale>;
  syncNow: () => Promise<void>;
  refreshSnapshot: (force?: boolean) => Promise<void>;
  retrySale: (clientRef: string) => Promise<void>;
  removeSale: (clientRef: string) => Promise<void>;
}

const OfflineContext = createContext<OfflineState | null>(null);

export function useOfflineMode(): OfflineState {
  const value = useContext(OfflineContext);
  if (!value) throw new Error("useOfflineMode doit être utilisé dans OfflineProvider");
  return value;
}

/** Enregistre le service worker et lui demande de garder la caisse hors ligne de cette version. */
function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => reg.active?.postMessage({ type: "precache", version: BUILD_ID }))
    .catch(() => {});
}

/**
 * Mode hors ligne : garde une copie de la caisse dans le téléphone, met les ventes en file pendant une coupure et
 * les envoie au retour d'internet.
 */
export function OfflineProvider({ identity: given, children }: { identity?: OfflineIdentity; children: React.ReactNode }) {
  const router = useRouter();
  const gUser = given?.userId;
  const gBusiness = given?.businessId;
  const gLocation = given?.locationId;

  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [outbox, setOutbox] = useState<OutboxSale[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [justSent, setJustSent] = useState(0);
  const syncing = useRef(false);
  const fetching = useRef(false);

  const identity = useMemo<OfflineIdentity | null>(() => {
    if (gUser && gBusiness && gLocation) return { userId: gUser, businessId: gBusiness, locationId: gLocation };
    return snapshot ? { userId: snapshot.user.id, businessId: snapshot.business.id, locationId: snapshot.location.id } : null;
  }, [gUser, gBusiness, gLocation, snapshot]);

  const reloadOutbox = useCallback(async () => {
    const all = await offlineDb.listOutbox();
    const purge = sentToPurge(all, new Date());
    for (const ref of purge) await offlineDb.deleteOutbox(ref);
    setOutbox(all.filter((s) => !purge.includes(s.clientRef)));
  }, []);

  const refreshSnapshot = useCallback(
    async (force = false) => {
      if (fetching.current) return;
      const current = await offlineDb.getSnapshot().catch(() => null);
      const same =
        current && (!gUser || (current.user.id === gUser && current.business.id === gBusiness && current.location.id === gLocation));
      if (!force && same && Date.now() - new Date(current.savedAt).getTime() < SNAPSHOT_MAX_AGE_MS) return;
      fetching.current = true;
      try {
        const res = await fetch("/api/hors-ligne/catalogue", { cache: "no-store" });
        setOnline(true);
        if (res.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (!res.ok) return;
        const next = (await res.json()) as OfflineSnapshot;
        await offlineDb.saveSnapshot(next);
        setSnapshot(next);
        setSessionExpired(false);
      } catch {
        setOnline(false);
      } finally {
        fetching.current = false;
      }
    },
    [gUser, gBusiness, gLocation],
  );

  const syncNow = useCallback(async () => {
    const userId = gUser ?? (await offlineDb.getSnapshot().catch(() => null))?.user.id;
    if (!userId || syncing.current) return;
    syncing.current = true;
    let sent = 0;
    const send = async () => {
      const pending = (await offlineDb.listOutbox()).filter((s) => s.userId === userId && s.status === "pending");
      for (let i = 0; i < pending.length; i += MAX_SYNC_BATCH) {
        const valid: OutboxSale[] = [];
        for (const s of pending.slice(i, i + MAX_SYNC_BATCH)) {
          if (offlineSaleInputSchema.safeParse(toSyncInput(s)).success) valid.push(s);
          else await offlineDb.putOutbox({ ...s, status: "refused", error: "Vente illisible : contactez Sama Stock." });
        }
        if (valid.length === 0) continue;
        let res: Response;
        try {
          res = await fetch("/api/hors-ligne/ventes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: OFFLINE_SYNC_VERSION, sales: valid.map(toSyncInput) }),
            cache: "no-store",
          });
        } catch {
          setOnline(false);
          return;
        }
        setOnline(true);
        if (res.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (!res.ok) return;
        const { results } = (await res.json()) as { results: SyncResult[] };
        for (const s of applySyncResults(valid, results, new Date())) {
          await offlineDb.putOutbox(s);
          if (s.status === "sent") sent += 1;
        }
      }
    };
    try {
      // Un seul envoi à la fois, même avec plusieurs onglets ouverts
      if (navigator.locks) await navigator.locks.request("sama-stock-sync", send);
      else await send();
    } catch {
      // Base locale indisponible : nouvel essai au prochain déclencheur
    } finally {
      syncing.current = false;
      await reloadOutbox().catch(() => {});
      if (sent > 0) {
        setJustSent(sent);
        router.refresh();
        void refreshSnapshot(true);
      }
    }
  }, [gUser, reloadOutbox, refreshSnapshot, router]);

  const enqueueSale = useCallback(
    async (draft: SaleDraft) => {
      if (!identity) throw new Error("La caisse hors ligne n'est pas prête.");
      const sale = buildOutboxSale(draft, identity, await offlineDb.nextLocalNumber(), new Date());
      await offlineDb.putOutbox(sale);
      await reloadOutbox();
      void syncNow();
      return sale;
    },
    [identity, reloadOutbox, syncNow],
  );

  const retrySale = useCallback(
    async (clientRef: string) => {
      const sale = (await offlineDb.listOutbox()).find((s) => s.clientRef === clientRef);
      if (!sale) return;
      await offlineDb.putOutbox({ ...sale, status: "pending", error: null });
      await reloadOutbox();
      void syncNow();
    },
    [reloadOutbox, syncNow],
  );

  const removeSale = useCallback(
    async (clientRef: string) => {
      await offlineDb.deleteOutbox(clientRef);
      await reloadOutbox();
    },
    [reloadOutbox],
  );

  // Démarrage : service worker, données du téléphone, copie à jour et envoi des ventes en attente
  useEffect(() => {
    let cancelled = false;
    registerServiceWorker();
    navigator.storage?.persist?.().catch(() => {});
    void (async () => {
      const snap = await offlineDb.getSnapshot().catch(() => null);
      await reloadOutbox().catch(() => {});
      if (cancelled) return;
      setSnapshot(snap);
      setOnline(navigator.onLine);
      setReady(true);
      if (navigator.onLine) {
        await refreshSnapshot();
        void syncNow();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSnapshot, reloadOutbox, syncNow]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void refreshSnapshot();
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshSnapshot, syncNow]);

  const summary = useMemo(() => outboxSummary(outbox, identity?.userId ?? null), [outbox, identity]);

  // Nouvel essai régulier tant qu'il reste des ventes à envoyer (sert aussi à détecter le retour du réseau)
  useEffect(() => {
    if (summary.pending === 0) return;
    const timer = setInterval(() => void syncNow(), RETRY_EVERY_MS);
    return () => clearInterval(timer);
  }, [summary.pending, syncNow]);

  useEffect(() => {
    if (justSent === 0) return;
    const timer = setTimeout(() => setJustSent(0), JUST_SENT_MS);
    return () => clearTimeout(timer);
  }, [justSent]);

  const value = useMemo<OfflineState>(
    () => ({
      ready,
      online,
      identity,
      snapshot,
      outbox,
      summary,
      sessionExpired,
      justSent,
      enqueueSale,
      syncNow,
      refreshSnapshot,
      retrySale,
      removeSale,
    }),
    [ready, online, identity, snapshot, outbox, summary, sessionExpired, justSent, enqueueSale, syncNow, refreshSnapshot, retrySale, removeSale],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

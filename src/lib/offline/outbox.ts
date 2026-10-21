import type { OutboxSale, SyncResult } from "./types";

/** Durée pendant laquelle une vente envoyée reste visible dans « En attente ». */
export const SENT_KEEP_MS = 24 * 60 * 60 * 1000;

/** Met à jour les ventes envoyées d'après la réponse du serveur. */
export function applySyncResults(sent: OutboxSale[], results: SyncResult[], now: Date): OutboxSale[] {
  const byRef = new Map(results.map((r) => [r.clientRef, r]));
  return sent.map((sale): OutboxSale => {
    const r = byRef.get(sale.clientRef);
    if (!r) return { ...sale, attempts: sale.attempts + 1 };
    if (r.status === "ok") {
      return { ...sale, status: "sent", error: null, serverId: r.id, serverNumber: r.number, sentAt: now.toISOString() };
    }
    if (r.status === "refused") return { ...sale, status: "refused", error: r.error, attempts: sale.attempts + 1 };
    return { ...sale, error: r.error, attempts: sale.attempts + 1 };
  });
}

/** Compteurs affichés dans le bandeau, pour l'utilisateur connecté. */
export function outboxSummary(outbox: OutboxSale[], userId: string | null) {
  const mine = userId ? outbox.filter((s) => s.userId === userId) : outbox;
  return {
    pending: mine.filter((s) => s.status === "pending").length,
    refused: mine.filter((s) => s.status === "refused").length,
    sent: mine.filter((s) => s.status === "sent").length,
  };
}

/** Ventes envoyées depuis plus de 24 h, à effacer du téléphone. */
export function sentToPurge(outbox: OutboxSale[], now: Date): string[] {
  return outbox
    .filter((s) => s.status === "sent" && s.sentAt && now.getTime() - new Date(s.sentAt).getTime() > SENT_KEEP_MS)
    .map((s) => s.clientRef);
}

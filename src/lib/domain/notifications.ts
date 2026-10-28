import { formatFCFA, formatQty } from "@/lib/format";
import { CHANNELS, isChannel } from "./sales";
import { stockStatus } from "./stock";

/** Ce qui déclenche une notification. */
export const NOTIFY_KINDS = ["sale", "sale_cancel", "order", "stock_low", "stock_out"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

export function isNotifyKind(value: unknown): value is NotifyKind {
  return typeof value === "string" && (NOTIFY_KINDS as readonly string[]).includes(value);
}

/** Réglages de chaque personne : un interrupteur par sujet, et le son dans l'application. */
export type NotifyTopic = "sale" | "order" | "stock";
export const TOPIC_OF: Record<NotifyKind, NotifyTopic> = {
  sale: "sale",
  sale_cancel: "sale",
  order: "order",
  stock_low: "stock",
  stock_out: "stock",
};

export const TOPICS: Record<NotifyTopic, { label: string; hint: string }> = {
  sale: { label: "Ventes", hint: "Chaque vente faite, annulée ou corrigée par votre équipe" },
  order: { label: "Commandes", hint: "Chaque nouvelle commande client" },
  stock: { label: "Stock bas et ruptures", hint: "Quand un produit passe sous son seuil d'alerte ou n'en a plus" },
};

export type NotifyPrefs = Record<NotifyTopic | "sound", boolean>;

/** Réglages enregistrés → réglages complets (tout est activé par défaut). */
export function notifyPrefs(raw: unknown): NotifyPrefs {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const on = (k: string) => r[k] !== false;
  return { sale: on("sale"), order: on("order"), stock: on("stock"), sound: on("sound") };
}

/** Rôles qui reçoivent les notifications. */
export const NOTIFIED_ROLES = ["owner", "manager"] as const;

export function receivesNotifications(role: string): boolean {
  return (NOTIFIED_ROLES as readonly string[]).includes(role);
}

/**
 * On n'est pas prévenu de sa propre vente ni de sa propre commande ; mais une alerte de stock va à tout le monde,
 * même à celui qui a vendu le dernier article (sinon un commerçant seul ne serait jamais prévenu).
 */
export function notifiesActor(kind: NotifyKind): boolean {
  return TOPIC_OF[kind] === "stock";
}

/** Alerte quand un produit passe sous son seuil (une seule fois : pas à chaque vente suivante). */
export function stockCrossing(before: number, after: number, threshold: number): "stock_low" | "stock_out" | null {
  const was = stockStatus(before, threshold);
  const now = stockStatus(after, threshold);
  if (now === "out" && was !== "out") return "stock_out";
  if (now === "low" && was === "ok") return "stock_low";
  return null;
}

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Dakar" });

/** « à l'instant », « il y a 5 min », « il y a 2 h », « hier », puis la date. */
export function timeAgo(date: Date | string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(date).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.floor(minutes / 60)} h`;
  if (minutes < 48 * 60) return "hier";
  return SHORT_DATE.format(new Date(date));
}

export interface NotifyMessage {
  kind: NotifyKind;
  title: string;
  body: string;
  href: string;
}

/** Prénom de la personne (« Fatou » pour « Fatou Ndiaye »). */
function first(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function saleMessage(s: { id: string; number: string; total: number; itemCount: number; actorName: string; offline?: boolean }): NotifyMessage {
  const articles = `${s.itemCount} produit${s.itemCount > 1 ? "s" : ""}`;
  return {
    kind: "sale",
    title: `Vente de ${formatFCFA(s.total)}`,
    body: `${first(s.actorName)} · ${articles} · ${s.number}${s.offline ? " · faite sans internet" : ""}`,
    href: `/ventes/${s.id}`,
  };
}

/** Vente annulée, ou corrigée (le lien mène alors à la nouvelle vente). */
export function saleCancelMessage(s: {
  id: string;
  number: string;
  total: number;
  actorName: string;
  replacement?: { id: string; number: string } | null;
}): NotifyMessage {
  return {
    kind: "sale_cancel",
    title: `${s.replacement ? "Vente corrigée" : "Vente annulée"} · ${s.number}`,
    body: `${first(s.actorName)} · ${formatFCFA(s.total)}${s.replacement ? ` · remplacée par ${s.replacement.number}` : ""}`,
    href: `/ventes/${s.replacement?.id ?? s.id}`,
  };
}

export function orderMessage(o: { id: string; number: string; total: number; customerName: string | null; channel: string }): NotifyMessage {
  const channel = isChannel(o.channel) ? CHANNELS[o.channel] : null;
  return {
    kind: "order",
    title: `Nouvelle commande · ${formatFCFA(o.total)}`,
    body: [o.customerName, channel, o.number].filter(Boolean).join(" · "),
    href: `/commandes/${o.id}`,
  };
}

export function stockMessage(p: {
  kind: "stock_low" | "stock_out";
  productId: string;
  name: string;
  available: number;
  unit: string;
  locationName?: string | null;
}): NotifyMessage {
  const where = p.locationName ? ` (${p.locationName})` : "";
  return {
    kind: p.kind,
    title: p.kind === "stock_out" ? "Rupture de stock" : "Stock bas",
    body: p.kind === "stock_out" ? `${p.name}${where} : il n'en reste plus` : `${p.name}${where} : plus que ${formatQty(Math.max(0, p.available), p.unit)}`,
    href: `/produits/${p.productId}`,
  };
}

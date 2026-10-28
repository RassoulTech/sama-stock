"use client";

import { Bell, ClipboardList, PackageX, Settings, ShoppingCart, TriangleAlert, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { timeAgo } from "@/lib/domain/notifications";
import { playSound, soundOf, unlockSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { markNotificationsSeen } from "@/server/actions/notifications";
import type { NotificationFeed, NotificationItem } from "@/server/queries/notifications";

const KIND_ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  sale: { icon: ShoppingCart, tone: "bg-accent text-primary" },
  sale_cancel: { icon: XCircle, tone: "bg-destructive/10 text-destructive" },
  order: { icon: ClipboardList, tone: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  stock_low: { icon: TriangleAlert, tone: "bg-saffron/15 text-warning dark:text-saffron" },
  stock_out: { icon: PackageX, tone: "bg-destructive/10 text-destructive" },
};

const POLL_MS = 30_000;

/**
 * Cloche des notifications (propriétaire et gérants). Tant que l'application est ouverte, elle regarde s'il y a du
 * nouveau toutes les 30 secondes, et tout de suite quand le téléphone reçoit une notification : petit message et son.
 */
export function NotificationBell() {
  const router = useRouter();
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [open, setOpen] = useState(false);
  const known = useRef<Set<string> | null>(null);
  // Vrai si la page est restée visible depuis la dernière lecture : sinon le téléphone a déjà sonné, on ne rejoue rien
  const watched = useRef(false);

  const announce = useCallback(
    (fresh: NotificationItem[], sound: boolean) => {
      if (fresh.length === 0) return;
      if (sound) playSound(soundOf(fresh[0]!.kind));
      for (const n of fresh.slice(0, 3)) {
        toast(n.title, {
          description: n.body,
          action: n.href ? { label: "Voir", onClick: () => router.push(n.href!) } : undefined,
        });
      }
    },
    [router],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as NotificationFeed;
      const visible = document.visibilityState === "visible";
      if (known.current) {
        const fresh = data.items.filter((n) => !known.current!.has(n.id));
        if (watched.current && visible) announce(fresh, data.prefs.sound);
      }
      known.current = new Set(data.items.map((n) => n.id));
      watched.current = visible;
      setFeed(data);
    } catch {
      // Pas d'internet : on réessaiera au prochain tour
    }
  }, [announce]);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
      else watched.current = false;
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "sama-notification") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", unlockSound, { once: true });
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", unlockSound);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [refresh]);

  function toggle(next: boolean) {
    setOpen(next);
    if (next && feed && feed.unread > 0) {
      setFeed({ ...feed, unread: 0 });
      void markNotificationsSeen();
    }
  }

  if (feed && !feed.enabled) return null;
  const unread = feed?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications : ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
          className="relative grid size-9 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="num absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Link
            href="/mon-compte#notifications"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Settings className="size-3.5" /> Réglages
          </Link>
        </div>
        {!feed || feed.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Aucune notification pour l&apos;instant. Vous serez prévenu des ventes, des commandes et du stock.
          </p>
        ) : (
          <ul className="max-h-[min(26rem,70dvh)] divide-y overflow-y-auto">
            {feed.items.map((n) => {
              const k = KIND_ICONS[n.kind] ?? KIND_ICONS.sale!;
              return (
                <li key={n.id}>
                  <Link href={n.href ?? "/tableau-de-bord"} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", k.tone)}>
                      <k.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{n.title}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">{n.body}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

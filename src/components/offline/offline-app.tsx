"use client";

import { ArrowLeft, Clock, PackageSearch, RotateCw, ShoppingCart, Store, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { LogoMark } from "@/components/brand/logo";
import { ShopAppSync } from "@/components/pwa/shop-app-sync";
import { PosScreen } from "@/components/pos/pos-screen";
import { EmptyState } from "@/components/shared/empty-state";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { StockBadge } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { brandCss } from "@/lib/domain/brand";
import { shopColors } from "@/lib/domain/shop-brand";
import { stockStatus } from "@/lib/domain/stock";
import { formatDateTime, formatFCFA, formatQty } from "@/lib/format";
import { canSellOffline, offlineLabel, saleTotals } from "@/lib/offline/sale";
import { localAvailability } from "@/lib/offline/stock";
import type { OfflineSnapshot, OutboxSale } from "@/lib/offline/types";
import { cn } from "@/lib/utils";
import { OfflineBanner } from "./offline-banner";
import { OfflineProvider, useOfflineMode } from "./offline-provider";
import { OfflineReceipt } from "./offline-receipt";

type Tab = "caisse" | "stock" | "attente";

const noSubscribe = () => () => {};
/** Paramètres de l'adresse, lus sans Suspense : la page reste entièrement statique. */
function useSearch(): URLSearchParams {
  const search = useSyncExternalStore(
    noSubscribe,
    () => window.location.search,
    () => "",
  );
  return new URLSearchParams(search);
}

/** « il y a 5 min », « il y a 3 h », « il y a 2 jours ». */
function age(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} jour${days > 1 ? "s" : ""}`;
}

export function OfflineApp() {
  return (
    <OfflineProvider>
      <OfflineScreen />
    </OfflineProvider>
  );
}

function Shell({ snapshot, children }: { snapshot: OfflineSnapshot | null; children: React.ReactNode }) {
  const o = useOfflineMode();
  const css = snapshot?.business.licensed ? brandCss(snapshot.business.brandColor) : null;
  return (
    <div className="min-h-dvh bg-white dark:bg-background">
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {/* Même sans internet, la barre du téléphone garde la couleur de la boutique */}
      <ShopAppSync
        light={snapshot?.business.licensed ? shopColors(snapshot.business.brandColor).sidebar : "#0b6e4f"}
        dark="#0b1210"
        rememberSlug={null}
      />
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-md dark:bg-background/90 print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          {snapshot?.business.licensed && snapshot.business.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
            <img src={snapshot.business.logo} alt="" className="size-7 shrink-0 rounded-[9px] object-cover ring-1 ring-border" />
          ) : (
            <LogoMark className="size-7" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] font-semibold">{snapshot?.business.name ?? "Sama Stock"}</span>
            {snapshot && <span className="block truncate text-xs text-muted-foreground">{snapshot.location.name}</span>}
          </span>
          {o.online && (
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <a href="/tableau-de-bord">
                <ArrowLeft /> Revenir à l&apos;application
              </a>
            </Button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

function OfflineScreen() {
  const o = useOfflineMode();
  const params = useSearch();
  const [tab, setTab] = useState<Tab | null>(null);
  const [receipt, setReceipt] = useState<OutboxSale | null>(null);
  const [now] = useState(() => new Date());
  const from = params.get("depuis");

  if (!o.ready) {
    return (
      <Shell snapshot={null}>
        <p className="py-24 text-center text-sm text-muted-foreground">Chargement…</p>
      </Shell>
    );
  }

  const s = o.snapshot;
  if (!s) {
    return (
      <Shell snapshot={null}>
        <OfflineBanner inOfflineApp />
        <div className="mx-auto max-w-lg px-4 py-16">
          <EmptyState
            icon={Store}
            title="Le mode hors ligne n'est pas encore prêt"
            description="Ouvrez Sama Stock une fois avec internet : le téléphone gardera une copie de la caisse et du stock pour les coupures."
            action={
              o.online && (
                <Button asChild>
                  <a href="/tableau-de-bord">Ouvrir Sama Stock</a>
                </Button>
              )
            }
          />
        </div>
      </Shell>
    );
  }

  const sell = canSellOffline(s, now);
  const products = localAvailability(
    s.products.map((p) => ({ ...p, imageUrl: null })),
    o.outbox,
    s.business.id,
    s.location.id,
  );
  const tabs: { id: Tab; label: string; icon: typeof Clock }[] = [];
  if (sell) tabs.push({ id: "caisse", label: "Caisse", icon: ShoppingCart });
  if (s.can.viewStock) tabs.push({ id: "stock", label: "Stock", icon: PackageSearch });
  tabs.push({ id: "attente", label: o.summary.pending > 0 ? `En attente (${o.summary.pending})` : "En attente", icon: Clock });
  const wanted: Tab = tab ?? (params.get("onglet") === "attente" ? "attente" : "caisse");
  const active = tabs.some((t) => t.id === wanted) ? wanted : tabs[0]!.id;

  return (
    <Shell snapshot={s}>
      <OfflineBanner inOfflineApp onShowPending={() => setTab("attente")} />
      <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:px-8">
        {from && !o.online && (
          <p className="mb-4 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            Cette page a besoin d&apos;internet. En attendant, vous pouvez vendre et voir votre stock.
          </p>
        )}
        {!sell && (
          <p className="mb-4 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            La caisse n&apos;est pas disponible hors ligne pour votre compte, ou l&apos;essai gratuit est terminé.
          </p>
        )}
        <div role="tablist" aria-label="Caisse hors ligne" className="mb-5 flex gap-2 overflow-x-auto print:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active === t.id}
              onClick={() => {
                setTab(t.id);
                setReceipt(null);
              }}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium text-muted-foreground",
                active === t.id && "border-primary/30 bg-accent text-accent-foreground",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        {active === "caisse" &&
          (receipt ? (
            <OfflineReceipt sale={receipt} business={s.business} sellerName={s.user.name} onNewSale={() => setReceipt(null)} />
          ) : products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Aucun produit dans la copie"
              description="Ouvrez l'application avec internet pour mettre la copie à jour."
            />
          ) : (
            <PosScreen
              products={products}
              categories={s.categories}
              customers={s.customers}
              submit={async (draft) => {
                setReceipt(await o.enqueueSale(draft));
                return null;
              }}
              allowCustomerCreate={false}
              bottomNav={false}
            />
          ))}
        {active === "stock" && <StockList products={products} savedAt={s.savedAt} now={now} />}
        {active === "attente" && <PendingList userId={s.user.id} />}
      </main>
    </Shell>
  );
}

function StockList({
  products,
  savedAt,
  now,
}: {
  products: { id: string; name: string; unit: string; salePrice: number; available: number; alertThreshold: number }[];
  savedAt: string;
  now: Date;
}) {
  const [q, setQ] = useState("");
  const old = now.getTime() - new Date(savedAt).getTime() > 24 * 60 * 60 * 1000;
  const visible = products.filter((p) => matchesSearch(q, p.name));
  return (
    <section className="space-y-4">
      <p className={cn("text-sm", old ? "font-medium text-warning dark:text-saffron" : "text-muted-foreground")}>
        Stock mis à jour {age(savedAt, now)}. Les ventes en attente sont déjà retirées.
      </p>
      <SearchInput value={q} onChange={setQ} placeholder="Rechercher un produit…" />
      {visible.length === 0 ? (
        <EmptyState icon={PackageSearch} title="Aucun produit" description="Vérifiez l'orthographe." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visible.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="num text-xs text-muted-foreground">{formatFCFA(p.salePrice)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="num font-semibold">{formatQty(p.available, p.unit)}</span>
                <StockBadge status={stockStatus(p.available, p.alertThreshold)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const STATUS_LABELS = { pending: "En attente d'envoi", refused: "Refusée", sent: "Envoyée" } as const;

function PendingList({ userId }: { userId: string }) {
  const o = useOfflineMode();
  const mine = o.outbox.filter((s) => s.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (mine.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Aucune vente en attente"
        description="Les ventes faites sans internet apparaîtront ici jusqu'à leur envoi."
      />
    );
  }
  return (
    <section className="space-y-3">
      {o.summary.pending > 0 && o.online && (
        <Button variant="outline" onClick={() => void o.syncNow()}>
          <RotateCw /> Envoyer maintenant
        </Button>
      )}
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {mine.map((s) => {
          const { total } = saleTotals(s.items, s.discount, s.paymentMethod, s.amountReceived);
          return (
            <li key={s.clientRef} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.serverNumber ?? offlineLabel(s.localNumber)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(s.createdAt)} · {s.items.length} article{s.items.length > 1 ? "s" : ""}
                    {s.customerName && <> · {s.customerName}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num font-semibold">{formatFCFA(total)}</p>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      s.status === "refused" ? "text-destructive" : s.status === "sent" ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {STATUS_LABELS[s.status]}
                  </p>
                </div>
              </div>
              {s.status === "refused" && (
                <div className="mt-2 rounded-lg bg-destructive/5 p-3 text-sm">
                  <p className="text-destructive">{s.error}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void o.retrySale(s.clientRef)}>
                      <RotateCw /> Réessayer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (window.confirm("Retirer cette vente du téléphone ? Elle ne sera jamais enregistrée.")) void o.removeSale(s.clientRef);
                      }}
                    >
                      <Trash2 /> Retirer
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

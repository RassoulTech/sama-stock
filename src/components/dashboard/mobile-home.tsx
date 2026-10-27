import { ArrowDownToLine, ChevronRight, FileText, type LucideIcon, Plus, Search, ShoppingCart, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { Greeting } from "@/components/shared/greeting";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MobileAction {
  href: string;
  label: string;
  icon: "pos" | "order" | "stock" | "quote" | "customers";
  primary?: boolean;
}

const ICONS: Record<MobileAction["icon"], LucideIcon> = {
  pos: ShoppingCart,
  order: Plus,
  stock: ArrowDownToLine,
  quote: FileText,
  customers: Users,
};

const WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "narrow", timeZone: "UTC" });

/**
 * Haut de l'accueil sur téléphone, façon application : bonjour, recherche, gros boutons ronds et la carte du jour
 * aux couleurs de la boutique. Sur ordinateur, l'accueil garde sa présentation en colonnes.
 */
export function MobileHome({
  firstName,
  dateLabel,
  alerts,
  searchable,
  actions,
  today,
  week,
  salesHref,
}: {
  firstName: string;
  /** « Mardi 27 octobre » : le nom de la boutique est déjà dans la barre du haut. */
  dateLabel: string;
  alerts: number;
  searchable: boolean;
  actions: MobileAction[];
  today: { label: string; revenue: number; count: number } | null;
  week: { day: string; revenue: number }[] | null;
  salesHref: string | null;
}) {
  const max = week ? Math.max(1, ...week.map((d) => d.revenue)) : 1;

  return (
    <section className="mb-6 space-y-5 md:grid md:grid-cols-2 md:items-start md:gap-6 md:space-y-0 lg:hidden" aria-label="Accueil">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.5rem] leading-tight font-semibold tracking-[-0.02em]">
              <Greeting />, {firstName}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{dateLabel}</p>
          </div>
          <Link
            href="/produits?etat=bas"
            aria-label={alerts > 0 ? `${alerts} alerte${alerts > 1 ? "s" : ""} de stock` : "Alertes de stock"}
            className="relative grid size-11 shrink-0 place-items-center rounded-full border bg-card text-foreground"
          >
            <TriangleAlert className="size-5" />
            {alerts > 0 && (
              <span className="num absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-background">
                {alerts > 99 ? "99+" : alerts}
              </span>
            )}
          </Link>
        </div>

        {searchable && (
          <form action="/produits" role="search" className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              name="q"
              placeholder="Chercher un produit"
              aria-label="Chercher un produit"
              className="h-12 w-full rounded-2xl border-0 bg-muted pr-4 pl-12 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </form>
        )}

        {actions.length > 0 && (
          <nav aria-label="Raccourcis" className="grid grid-cols-4 gap-2">
            {actions.map((a) => {
              const Icon = ICONS[a.icon];
              return (
                <Link key={a.href} href={a.href} className="flex flex-col items-center gap-1.5 text-center text-xs font-medium">
                  <span
                    className={cn(
                      "grid size-14 place-items-center rounded-full transition-transform active:scale-95",
                      a.primary ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-muted text-foreground",
                    )}
                  >
                    <Icon className="size-6" />
                  </span>
                  {a.label}
                </Link>
              );
            })}
          </nav>
        )}

      </div>

      {today && (
        <div className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-[0_18px_40px_-20px_var(--primary)]">
          <div aria-hidden className="absolute -top-16 -right-10 size-48 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between gap-3">
            <p className="text-sm font-medium opacity-85">{today.label}</p>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
              {today.count} vente{today.count > 1 ? "s" : ""}
            </span>
          </div>
          <p className="num relative mt-2 text-[2rem] leading-none font-semibold tracking-[-0.03em]">{formatFCFA(today.revenue)}</p>

          {week && (
            <div className="relative mt-5 flex h-16 items-end gap-2" aria-label="Ventes des 7 derniers jours">
              {week.map((d, i) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn("w-full max-w-6 rounded-full", i === week.length - 1 ? "bg-white" : "bg-white/35")}
                    style={{ height: `${Math.max(6, Math.round((d.revenue / max) * 44))}px` }}
                    title={`${d.day} : ${formatFCFA(d.revenue)}`}
                  />
                  <span className="text-[10px] uppercase opacity-75">{WEEKDAY.format(new Date(`${d.day}T12:00:00Z`))}</span>
                </div>
              ))}
            </div>
          )}

          {salesHref && (
            <Link
              href={salesHref}
              className="relative mt-4 inline-flex h-9 items-center gap-1 rounded-full bg-white/15 px-3.5 text-sm font-semibold transition-colors hover:bg-white/25"
            >
              Voir les ventes <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

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
 * Haut de l'accueil sur téléphone, façon application : bonjour, recherche, raccourcis en tuiles et la carte du jour
 * aux couleurs de la boutique (dégradé de sa couleur principale vers celle du menu). Sur ordinateur, l'accueil garde
 * sa présentation en colonnes.
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
  const basket = today && today.count > 0 ? Math.round(today.revenue / today.count) : null;
  const weekAverage = week && week.length > 0 ? Math.round(week.reduce((s, d) => s + d.revenue, 0) / week.length) : null;

  return (
    <section className="mb-7 space-y-6 md:grid md:grid-cols-2 md:items-start md:gap-6 md:space-y-0 lg:hidden" aria-label="Accueil">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              <Greeting />,
            </p>
            <h1 className="truncate text-[1.75rem] leading-tight font-bold">{firstName}</h1>
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{dateLabel}</p>
          </div>
          <Link
            href="/produits?etat=bas"
            aria-label={alerts > 0 ? `${alerts} alerte${alerts > 1 ? "s" : ""} de stock` : "Alertes de stock"}
            className="relative mt-1 grid size-11 shrink-0 place-items-center rounded-2xl border bg-card text-foreground shadow-[0_1px_2px_rgb(11_19_16/0.05)] transition-colors active:bg-muted"
          >
            <TriangleAlert className="size-5" />
            {alerts > 0 && (
              <span className="num absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-background">
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
              className="h-12 w-full rounded-2xl border bg-card pr-4 pl-12 text-base shadow-[0_1px_2px_rgb(11_19_16/0.05)] outline-none placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </form>
        )}

        {actions.length > 0 && (
          <nav aria-label="Raccourcis" className="grid grid-cols-4 gap-3">
            {actions.map((a) => {
              const Icon = ICONS[a.icon];
              return (
                <Link key={a.href} href={a.href} className="group flex flex-col items-center gap-2 text-center text-xs font-semibold">
                  <span
                    className={cn(
                      "grid aspect-square w-full max-w-16 place-items-center rounded-2xl transition-transform group-active:scale-95",
                      a.primary
                        ? "bg-primary text-primary-foreground shadow-[0_10px_22px_-10px_var(--primary)]"
                        : "border bg-card text-primary shadow-[0_1px_2px_rgb(11_19_16/0.05)]",
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
        <div
          className="relative overflow-hidden rounded-[1.75rem] p-5 text-primary-foreground shadow-[0_22px_44px_-22px_var(--primary)]"
          style={{ backgroundImage: "linear-gradient(140deg, var(--primary) 0%, var(--sidebar) 100%)" }}
        >
          <div aria-hidden className="absolute -top-20 -right-14 size-56 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-24 -left-10 size-48 rounded-full bg-white/[0.06]" />
          <div className="relative flex items-center justify-between gap-3">
            <p className="text-sm font-medium opacity-85">{today.label}</p>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
              {today.count} vente{today.count > 1 ? "s" : ""}
            </span>
          </div>
          <p className="amount relative mt-2 text-[2.25rem] leading-none font-bold" data-assistant="tdb.chiffre">
            {formatFCFA(today.revenue)}
          </p>

          {(basket !== null || weekAverage !== null) && (
            <dl className="relative mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 text-sm">
              <div className="bg-white/[0.04] px-3 py-2.5">
                <dt className="text-xs opacity-75">Panier moyen</dt>
                <dd className="amount mt-0.5 font-bold">{basket !== null ? formatFCFA(basket) : "—"}</dd>
              </div>
              <div className="bg-white/[0.04] px-3 py-2.5">
                <dt className="text-xs opacity-75">Moyenne 7 jours</dt>
                <dd className="amount mt-0.5 font-bold">{weekAverage !== null ? formatFCFA(weekAverage) : "—"}</dd>
              </div>
            </dl>
          )}

          {week && (
            <div className="relative mt-5 flex h-16 items-end gap-2" aria-label="Ventes des 7 derniers jours">
              {week.map((d, i) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn("w-full max-w-6 rounded-full", i === week.length - 1 ? "bg-white" : "bg-white/30")}
                    style={{ height: `${Math.max(6, Math.round((d.revenue / max) * 44))}px` }}
                    title={`${d.day} : ${formatFCFA(d.revenue)}`}
                  />
                  <span className="text-[10px] font-medium uppercase opacity-75">{WEEKDAY.format(new Date(`${d.day}T12:00:00Z`))}</span>
                </div>
              ))}
            </div>
          )}

          {salesHref && (
            <Link
              href={salesHref}
              className="relative mt-4 inline-flex h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-semibold text-primary shadow-sm transition-opacity active:opacity-85"
            >
              Voir les ventes <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

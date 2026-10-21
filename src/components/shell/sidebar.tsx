"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { NAV_GROUP_LABELS, NAV_GROUPS, type NavGroup, type NavItem } from "./nav";
import { NavIconView } from "./nav-icon";

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  items,
  footer,
  header,
  homeHref = "/tableau-de-bord",
  labels,
  badges,
  brand,
}: {
  items: NavItem[];
  footer?: React.ReactNode;
  header?: React.ReactNode;
  homeHref?: string;
  labels?: Partial<Record<NavGroup, string | null>>;
  /** Compteur à droite d'une rubrique (par adresse) ; « alert » signale quelque chose à traiter. */
  badges?: Partial<Record<string, { value: number; tone: "alert" | "muted" }>>;
  /** Marque affichée en haut du menu à la place de Sama Stock (application d'un client sous licence). */
  brand?: React.ReactNode;
}) {
  const pathname = usePathname();
  const groupLabels = { ...NAV_GROUP_LABELS, ...labels };
  const groups = NAV_GROUPS
    .map((g) => ({ group: g, items: items.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);
  // L'élément le plus précis gagne (« /admin/commerces » ne doit pas aussi activer « /admin »)
  const activeHref = items
    .filter((i) => isActive(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex print:hidden">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Link href={homeHref} aria-label="Accueil" className="min-w-0">
          {brand ?? <Logo inverted />}
        </Link>
        {header}
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3" aria-label="Navigation principale">
        {groups.map(({ group, items }) => (
          <div key={group} className="space-y-0.5">
            {groupLabels[group] && (
              <p className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-sidebar-foreground/60 uppercase">
                {groupLabels[group]}
              </p>
            )}
            {items.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[0.8125rem] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active &&
                      "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:-left-2.5 before:w-0.5 before:rounded-full before:bg-sidebar-primary",
                  )}
                >
                  <NavIconView
                    icon={item.icon}
                    className={cn("size-4", active ? "text-sidebar-primary" : "text-sidebar-foreground/65")}
                  />
                  {item.label}
                  {item.href === "/vendre" && (
                    <kbd className="ml-auto rounded border border-sidebar-primary/50 bg-sidebar-primary/15 px-1.5 py-px font-sans text-[10px] font-semibold tracking-wide text-sidebar-foreground">
                      CAISSE
                    </kbd>
                  )}
                  {badges?.[item.href] && (
                    <span
                      className={cn(
                        "num ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold",
                        badges[item.href]!.tone === "alert"
                          ? "bg-saffron text-saffron-foreground"
                          : "bg-sidebar-foreground/10 text-sidebar-foreground/75",
                      )}
                    >
                      {badges[item.href]!.value}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {footer && <div className="border-t border-sidebar-border p-3">{footer}</div>}
    </aside>
  );
}

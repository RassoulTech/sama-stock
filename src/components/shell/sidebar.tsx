"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav";
import { NavIconView } from "./nav-icon";

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const GROUP_LABELS: Record<NavItem["group"], string | null> = {
  main: null,
  manage: "Gestion",
  admin: "Sama Stock",
};

export function Sidebar({ items, footer }: { items: NavItem[]; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const groups = (["main", "manage", "admin"] as const)
    .map((g) => ({ group: g, items: items.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar lg:flex print:hidden">
      <div className="flex h-16 items-center px-5">
        <Link href="/tableau-de-bord" aria-label="Accueil Sama Stock">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        {groups.map(({ group, items }) => (
          <div key={group} className="space-y-1">
            {GROUP_LABELS[group] && (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {GROUP_LABELS[group]}
              </p>
            )}
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                  )}
                >
                  <NavIconView
                    icon={item.icon}
                    className={cn("size-[18px]", active ? "text-sidebar-primary" : "text-muted-foreground")}
                  />
                  {item.label}
                  {item.href === "/vendre" && (
                    <span className="ml-auto rounded-md bg-saffron px-1.5 py-0.5 text-[10px] font-bold text-saffron-foreground">
                      CAISSE
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

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
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/tableau-de-bord" aria-label="Accueil Sama Stock">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3" aria-label="Navigation principale">
        {groups.map(({ group, items }) => (
          <div key={group} className="space-y-0.5">
            {GROUP_LABELS[group] && (
              <p className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
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
                    "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[0.8125rem] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active &&
                      "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:-left-2.5 before:w-0.5 before:rounded-full before:bg-sidebar-primary",
                  )}
                >
                  <NavIconView
                    icon={item.icon}
                    className={cn("size-4", active ? "text-sidebar-primary" : "text-muted-foreground")}
                  />
                  {item.label}
                  {item.href === "/vendre" && (
                    <kbd className="ml-auto rounded border border-saffron/40 bg-saffron/10 px-1.5 py-px font-sans text-[10px] font-semibold tracking-wide text-warning dark:text-saffron">
                      CAISSE
                    </kbd>
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

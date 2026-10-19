"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/components/shell/sidebar";
import { NavIconView } from "@/components/shell/nav-icon";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./admin-nav";

/** Menu de l'administration sur téléphone et tablette (le menu latéral n'apparaît qu'en grand écran). */
export function AdminMobileNav() {
  const pathname = usePathname();
  const activeHref = ADMIN_NAV.filter((i) => isActive(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Administration" className="scroll-row flex gap-1 overflow-x-auto border-b px-3 py-2 lg:hidden">
      {ADMIN_NAV.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <NavIconView icon={item.icon} className="size-4" />
            {item.short ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}

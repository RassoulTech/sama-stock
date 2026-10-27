"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { bottomNavItems, NAV_GROUP_LABELS, NAV_GROUPS, type NavItem } from "./nav";
import { NavIconView } from "./nav-icon";
import { isActive } from "./sidebar";

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const main = bottomNavItems(items);

  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {main.map((item) => {
          const active = isActive(pathname, item.href);
          if (item.href === "/vendre") {
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  className={cn("-mt-6 flex flex-col items-center gap-1 text-[11px] font-semibold", active ? "text-primary" : "text-foreground")}
                  aria-current={active ? "page" : undefined}
                >
                  {/* Bouton central rond, aux couleurs de la boutique */}
                  <span className="grid size-[3.75rem] place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-8px_var(--primary)] ring-[5px] ring-card transition-transform active:scale-95">
                    <NavIconView icon={item.icon} className="size-6" />
                  </span>
                  {item.short ?? item.label}
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                  active && "font-semibold text-primary",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-accent")}>
                  <NavIconView icon={item.icon} className="size-[22px]" />
                </span>
                {item.short ?? item.label}
              </Link>
            </li>
          );
        })}
        {Array.from({ length: Math.max(0, 4 - main.length) }).map((_, i) => (
          <li key={`empty-${i}`} />
        ))}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
              >
                <Menu className="size-[22px]" aria-hidden />
                Plus
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 overflow-y-auto px-4 pb-8">
                {NAV_GROUPS.map((group) => {
                  const groupItems = items.filter((i) => i.group === group);
                  if (groupItems.length === 0) return null;
                  return (
                    <section key={group}>
                      {NAV_GROUP_LABELS[group] && (
                        <p className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          {NAV_GROUP_LABELS[group]}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        {groupItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center text-xs font-medium",
                              isActive(pathname, item.href) && "border-primary bg-accent text-accent-foreground",
                            )}
                          >
                            <span className="grid size-10 place-items-center rounded-xl bg-muted">
                              <NavIconView icon={item.icon} className="size-5" />
                            </span>
                            {item.short ?? item.label}
                          </Link>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

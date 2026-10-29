"use client";

import { ChevronRight, Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { bottomNavItems, NAV_GROUP_LABELS, NAV_GROUPS, type NavItem } from "./nav";
import { NavIconView } from "./nav-icon";
import { isActive } from "./sidebar";

/**
 * Barre du bas sur téléphone : une pilule flottante. La rubrique ouverte montre son nom, les autres seulement leur
 * icône ; « Vendre » est le rond aux couleurs de la boutique. Hauteur totale 4rem (la caisse se cale dessus).
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const main = bottomNavItems(items);
  const inMenu = !main.some((i) => isActive(pathname, i.href)) && items.some((i) => isActive(pathname, i.href));

  return (
    <nav aria-label="Navigation" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-safe lg:hidden print:hidden">
      <ul className="pointer-events-auto mx-auto mb-2 flex h-14 max-w-md items-center justify-between gap-1 rounded-full border bg-card/95 px-1.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.28)] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        {main.map((item) => {
          const active = isActive(pathname, item.href);
          const label = item.short ?? item.label;
          if (item.href === "/vendre") {
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)] transition-transform active:scale-95",
                    active && "ring-2 ring-primary/30 ring-offset-2 ring-offset-card",
                  )}
                >
                  <NavIconView icon={item.icon} className="size-5" />
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-label={active ? undefined : label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-full text-muted-foreground transition-[background-color,color,padding] active:scale-95",
                  active ? "bg-muted px-4 text-[13px] font-semibold text-foreground" : "w-11",
                )}
              >
                <NavIconView icon={item.icon} className="size-[21px] shrink-0" />
                {active && <span className="truncate">{label}</span>}
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Plus de rubriques"
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-full text-muted-foreground transition-colors active:scale-95",
                  inMenu || open ? "bg-muted px-4 text-[13px] font-semibold text-foreground" : "w-11",
                )}
              >
                <Ellipsis className="size-[22px] shrink-0" aria-hidden />
                {(inMenu || open) && <span>Plus</span>}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-[1.75rem] bg-background">
              <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
              <SheetHeader className="pb-3">
                <SheetTitle className="text-lg">Toutes les rubriques</SheetTitle>
                <SheetDescription>Touchez une rubrique pour l&apos;ouvrir.</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                {NAV_GROUPS.map((group) => {
                  const groupItems = items.filter((i) => i.group === group);
                  if (groupItems.length === 0) return null;
                  return (
                    <section key={group}>
                      {NAV_GROUP_LABELS[group] && (
                        <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                          {NAV_GROUP_LABELS[group]}
                        </p>
                      )}
                      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                        {groupItems.map((item) => {
                          const active = isActive(pathname, item.href);
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setOpen(false)}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2.5 text-[0.9375rem] font-medium transition-colors active:bg-muted",
                                  active && "bg-accent/60 text-accent-foreground",
                                )}
                              >
                                <span
                                  className={cn(
                                    "grid size-9 shrink-0 place-items-center rounded-xl",
                                    active ? "bg-primary text-primary-foreground" : "bg-accent text-primary",
                                  )}
                                >
                                  <NavIconView icon={item.icon} className="size-[18px]" />
                                </span>
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {active ? (
                                  <span className="size-2 rounded-full bg-primary" aria-hidden />
                                ) : (
                                  <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
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

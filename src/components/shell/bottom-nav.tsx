"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { bottomNavItems, type NavItem } from "./nav";
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
                  className="-mt-5 flex flex-col items-center gap-1 text-[11px] font-semibold"
                  aria-current={active ? "page" : undefined}
                >
                  <span className="grid size-14 place-items-center rounded-xl bg-saffron text-saffron-foreground shadow-lg shadow-saffron/30 ring-4 ring-background">
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
                <NavIconView icon={item.icon} className="size-[22px]" />
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
              <div className="grid grid-cols-3 gap-2 overflow-y-auto px-4 pb-8">
                {items.map((item) => (
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
                    {item.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

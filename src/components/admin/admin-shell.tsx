"use client";

import { ArrowLeft, ChevronRight, Ellipsis, Plus, Search, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { isActive } from "@/components/shell/sidebar";
import { NavIconView } from "@/components/shell/nav-icon";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ADMIN_BOTTOM_NAV, ADMIN_NAV, ADMIN_NAV_LABELS, type NavBadges } from "./admin-nav";

export interface SearchIndex {
  businesses: { id: string; name: string; city: string | null; owner: string | null; email: string | null }[];
  users: { id: string; name: string; email: string }[];
}

const SearchContext = createContext<() => void>(() => {});

/** Recherche instantanée de l'administration : pages, commerces, utilisateurs (Ctrl K ou ⌘K). */
export function AdminSearchProvider({ index, children }: { index: SearchIndex; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <SearchContext.Provider value={() => setOpen(true)}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title="Rechercher" description="Un commerce, un utilisateur ou une page">
        <Command>
          <CommandInput placeholder="Commerce, propriétaire, email, ville…" />
          <CommandList className="max-h-[60dvh]">
            <CommandEmpty>Aucun résultat.</CommandEmpty>
            <CommandGroup heading="Pages">
              {ADMIN_NAV.map((item) => (
                <CommandItem key={item.href} value={`page ${item.label}`} onSelect={() => go(item.href)}>
                  <NavIconView icon={item.icon} className="size-4 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {index.businesses.length > 0 && (
              <CommandGroup heading="Commerces">
                {index.businesses.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={`commerce ${b.name} ${b.owner ?? ""} ${b.email ?? ""} ${b.city ?? ""} ${b.id}`}
                    onSelect={() => go(`/admin/commerces/${b.id}`)}
                  >
                    <Store className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{b.name}</span>
                      <span className="text-muted-foreground"> · {[b.owner, b.city].filter(Boolean).join(" · ") || "—"}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {index.users.length > 0 && (
              <CommandGroup heading="Utilisateurs">
                {index.users.map((u) => (
                  <CommandItem key={u.id} value={`utilisateur ${u.name} ${u.email} ${u.id}`} onSelect={() => go(`/admin/utilisateurs?q=${encodeURIComponent(u.email)}`)}>
                    <UserRound className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{u.name || "Sans nom"}</span>
                      <span className="text-muted-foreground"> · {u.email}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </SearchContext.Provider>
  );
}

/** Bouton qui ouvre la recherche : une barre sur ordinateur, une loupe sur téléphone. */
export function AdminSearchButton({ compact = false }: { compact?: boolean }) {
  const open = useContext(SearchContext);
  if (compact) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Rechercher un commerce ou un utilisateur"
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="size-[1.125rem]" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Search className="size-4" />
      <span className="flex-1 truncate text-left">Rechercher un commerce, un utilisateur…</span>
      <kbd className="rounded border bg-card px-1.5 font-sans text-[11px] font-medium">Ctrl K</kbd>
    </button>
  );
}

/**
 * Barre du bas sur téléphone, comme dans l'application : pilule flottante, la rubrique ouverte montre son nom, les
 * autres leur icône ; au centre, le rond « Nouvelle licence ». « ⋯ » ouvre toutes les rubriques.
 */
export function AdminBottomNav({
  badges,
  user,
  showBusinessLink,
}: {
  badges: NavBadges;
  user: { name: string; email: string };
  showBusinessLink: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeHref = ADMIN_NAV.filter((i) => isActive(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const main = ADMIN_NAV.filter((i) => ADMIN_BOTTOM_NAV.includes(i.href));
  const menuAlert = ADMIN_NAV.some((i) => !ADMIN_BOTTOM_NAV.includes(i.href) && badges[i.href]?.tone === "alert");
  const inMenu = activeHref !== undefined && !ADMIN_BOTTOM_NAV.includes(activeHref);
  const newLicence = pathname.startsWith("/admin/licences/nouveau");

  const tab = (item: (typeof ADMIN_NAV)[number]) => {
    const active = item.href === activeHref && !newLicence;
    const badge = badges[item.href];
    const label = item.short ?? item.label;
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
          <span className="relative shrink-0">
            <NavIconView icon={item.icon} className="size-[21px]" />
            {badge?.tone === "alert" && (
              <span className="num absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-saffron px-1 text-center text-[10px] leading-4 font-bold text-saffron-foreground ring-2 ring-card">
                {badge.value}
              </span>
            )}
          </span>
          {active && <span className="truncate">{label}</span>}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Administration" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-safe lg:hidden">
      <ul className="pointer-events-auto mx-auto mb-2 flex h-14 max-w-md items-center justify-between gap-1 rounded-full border bg-card/95 px-1.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.28)] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        {main.slice(0, 2).map(tab)}
        <li>
          <Link
            href="/admin/licences/nouveau"
            aria-label="Nouvelle licence"
            aria-current={newLicence ? "page" : undefined}
            className={cn(
              "grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_var(--primary)] transition-transform active:scale-95",
              newLicence && "ring-2 ring-primary/30 ring-offset-2 ring-offset-card",
            )}
          >
            <Plus className="size-5" />
          </Link>
        </li>
        {main.slice(2).map(tab)}
        <li>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Toutes les rubriques"
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-full text-muted-foreground transition-colors active:scale-95",
              inMenu || open ? "bg-muted px-4 text-[13px] font-semibold text-foreground" : "w-11",
            )}
          >
            <span className="relative shrink-0">
              <Ellipsis className="size-[22px]" aria-hidden />
              {menuAlert && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-saffron ring-2 ring-card" />}
            </span>
            {(inMenu || open) && <span>Plus</span>}
          </button>
        </li>
      </ul>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] gap-0 rounded-t-[1.75rem] bg-background">
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          <SheetHeader className="pb-3">
            <SheetTitle className="text-lg">Administration</SheetTitle>
            <SheetDescription>Touchez une rubrique pour l&apos;ouvrir.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {initials(user.name || user.email)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.name || user.email}</span>
                <span className="block truncate text-xs text-muted-foreground">Super administrateur · {user.email}</span>
              </span>
            </div>
            {(["main", "manage", "admin"] as const).map((group) => (
              <section key={group}>
                <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{ADMIN_NAV_LABELS[group]}</p>
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                  {ADMIN_NAV.filter((i) => i.group === group).map((item) => {
                    const badge = badges[item.href];
                    const active = item.href === activeHref;
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
                          {badge && (
                            <span
                              className={cn(
                                "num min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-bold",
                                badge.tone === "alert" ? "bg-saffron text-saffron-foreground" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {badge.value}
                            </span>
                          )}
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
            ))}
            <section className="space-y-2 rounded-2xl border bg-card p-2">
              <ThemeToggle withLabel className="w-full justify-start" />
              {showBusinessLink && (
                <Link
                  href="/tableau-de-bord"
                  className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="size-[1.125rem]" /> Retour à mon commerce
                </Link>
              )}
              <SignOutButton variant="outline" className="w-full" />
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

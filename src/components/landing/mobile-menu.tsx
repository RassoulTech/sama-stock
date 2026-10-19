"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/** Menu « hamburger » de la page d'accueil sur mobile : sections, thème, connexion. */
export function MobileMenu({ sections, loggedIn }: { sections: readonly (readonly [string, string])[]; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="menu-mobile"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <div
          id="menu-mobile"
          className="menu-in absolute inset-x-0 top-[calc(100%+0.5rem)] origin-top rounded-2xl border bg-background p-2 shadow-[0_24px_60px_-20px_rgb(11_19_16/0.35)]"
        >
          <nav aria-label="Sections" className="flex flex-col">
            {sections.map(([href, label], i) => (
              <a
                key={href}
                href={href}
                onClick={close}
                style={{ animationDelay: `${60 + i * 40}ms` }}
                className="menu-item flex h-12 items-center justify-between rounded-xl px-4 text-[0.9375rem] font-medium hover:bg-muted"
              >
                {label}
                <ArrowRight className="size-4 text-muted-foreground" />
              </a>
            ))}
          </nav>
          <div className="my-2 border-t" />
          <ThemeToggle withLabel className="h-12 w-full justify-start rounded-xl px-4 text-[0.9375rem]" />
          <div className="mt-2 grid gap-2 p-1">
            {loggedIn ? (
              <Link
                href="/tableau-de-bord"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-[0.9375rem] font-semibold text-primary-foreground"
              >
                Mon espace <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/inscription"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-saffron text-[0.9375rem] font-semibold text-saffron-foreground"
                >
                  Commencer gratuitement <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/connexion"
                  className="inline-flex h-12 items-center justify-center rounded-xl border text-[0.9375rem] font-medium"
                >
                  Connexion
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

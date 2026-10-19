import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import type { NavItem } from "@/components/shell/nav";
import { Sidebar } from "@/components/shell/sidebar";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { NO_INDEX } from "@/lib/seo";
import { requireSuperAdmin } from "@/server/context";

export const metadata: Metadata = { robots: NO_INDEX };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSuperAdmin();
  const nav: NavItem[] = [
    { href: "/admin", label: "Commerces", icon: "customers", group: "main" },
    ...(ctx.business
      ? [{ href: "/tableau-de-bord", label: "Mon commerce", icon: "dashboard", group: "manage" } satisfies NavItem]
      : []),
  ];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[244px_minmax(0,1fr)]">
      <Sidebar
        items={nav}
        homeHref="/admin"
        labels={{ main: "Administration", manage: "Raccourcis" }}
        footer={
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-accent text-xs font-semibold text-sidebar-foreground ring-1 ring-sidebar-border">
              {initials(ctx.user.name || ctx.user.email)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] font-medium">{ctx.user.name || ctx.user.email}</span>
              <span className="block text-xs text-sidebar-foreground/65">Super administrateur</span>
            </span>
          </div>
        }
      />
      <div className="flex min-w-0 flex-col bg-white dark:bg-background">
        <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:bg-background/85 dark:supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/admin" className="flex items-center gap-2.5 lg:hidden" aria-label="Administration">
              <LogoMark className="size-7" />
            </Link>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              <ShieldCheck className="size-3.5" /> Administration
            </span>
            <div className="ml-auto flex items-center gap-2">
              {ctx.business && (
                <Button asChild variant="ghost" size="sm" className="lg:hidden">
                  <Link href="/tableau-de-bord">
                    <ArrowLeft /> Mon commerce
                  </Link>
                </Button>
              )}
              <SignOutButton variant="outline" size="sm" />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

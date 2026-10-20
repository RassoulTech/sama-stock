import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminBottomNav, AdminSearchButton, AdminSearchProvider } from "@/components/admin/admin-shell";
import { ADMIN_NAV, ADMIN_NAV_LABELS } from "@/components/admin/admin-nav";
import { LogoMark } from "@/components/brand/logo";
import { Sidebar } from "@/components/shell/sidebar";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { NO_INDEX } from "@/lib/seo";
import { requireSuperAdmin } from "@/server/context";
import { adminNavBadges, adminSearchIndex } from "@/server/queries/admin";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Administration" }, robots: NO_INDEX };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSuperAdmin();
  const [badges, index] = await Promise.all([adminNavBadges(), adminSearchIndex()]);
  const name = ctx.user.name || ctx.user.email;

  return (
    <AdminSearchProvider index={index}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[244px_minmax(0,1fr)]">
        <Sidebar
          items={ADMIN_NAV}
          homeHref="/admin"
          labels={ADMIN_NAV_LABELS}
          badges={badges}
          footer={
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-accent text-xs font-semibold text-sidebar-foreground ring-1 ring-sidebar-border">
                {initials(name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[0.8125rem] font-medium">{name}</span>
                <span className="block text-xs text-sidebar-foreground/65">Super administrateur</span>
              </span>
            </div>
          }
        />
        <div className="flex min-w-0 flex-col bg-white dark:bg-background">
          <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:bg-background/85 dark:supports-[backdrop-filter]:bg-background/70">
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
              {/* Téléphone : logo, titre et loupe ; le reste est dans « Menu », en bas */}
              <Link href="/admin" className="flex min-w-0 items-center gap-2.5 lg:hidden" aria-label="Administration">
                <LogoMark className="size-7" />
                <span className="truncate text-[0.9375rem] font-semibold">Administration</span>
              </Link>
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground lg:inline-flex">
                <ShieldCheck className="size-3.5" /> Administration
              </span>
              <div className="hidden flex-1 lg:block">
                <AdminSearchButton />
              </div>
              <div className="ml-auto flex items-center gap-1 lg:hidden">
                <AdminSearchButton compact />
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <ThemeToggle />
                {ctx.business && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/tableau-de-bord">
                      <ArrowLeft /> Mon commerce
                    </Link>
                  </Button>
                )}
                <SignOutButton variant="outline" size="sm" />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
        </div>
        <AdminBottomNav badges={badges} user={{ name: ctx.user.name, email: ctx.user.email }} showBusinessLink={Boolean(ctx.business)} />
      </div>
    </AdminSearchProvider>
  );
}

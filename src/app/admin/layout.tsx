import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/server/context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSuperAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo />
            <span className="hidden items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground sm:inline-flex">
              <ShieldCheck className="size-3.5" /> Administration
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
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
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}

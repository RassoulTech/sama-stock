import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LEGAL, LEGAL_PAGES } from "@/lib/legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white dark:bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Sama Stock, accueil">
            <Logo />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Retour à l&apos;accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:px-6">
          <nav className="flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Pages légales">
            {LEGAL_PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="hover:text-foreground">
                {p.label}
              </Link>
            ))}
          </nav>
          <p className="num">
            Sama Stock · {LEGAL.editor} · NINEA {LEGAL.ninea} · RCCM {LEGAL.rccm} · {LEGAL.city}
          </p>
        </div>
      </footer>
    </div>
  );
}

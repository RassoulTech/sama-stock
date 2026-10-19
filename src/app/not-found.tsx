import { ArrowLeft, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LEGAL_PAGES } from "@/lib/legal";

export const metadata: Metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-white dark:bg-background">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
        <Link href="/" aria-label="Sama Stock, accueil">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <span className="grid size-16 place-items-center rounded-2xl bg-accent text-primary">
          <SearchX className="size-8" />
        </span>
        <p className="mt-6 text-sm font-medium text-primary">Erreur 404</p>
        <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.035em]">Cette page n&apos;existe pas</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          L&apos;adresse est peut-être mal écrite, ou la page a été déplacée. Voici où continuer :
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-[#095f44]"
          >
            <ArrowLeft className="size-4" /> Retour à l&apos;accueil
          </Link>
          <Link href="/connexion" className="inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium hover:bg-muted">
            Connexion
          </Link>
          <Link href="/inscription" className="inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium hover:bg-muted">
            Essai gratuit
          </Link>
        </div>
      </main>
      <footer className="mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-x-5 gap-y-1.5 px-4 py-8 text-xs text-muted-foreground">
        {LEGAL_PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="hover:text-foreground">
            {p.label}
          </Link>
        ))}
      </footer>
    </div>
  );
}

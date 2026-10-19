import {
  ArrowRight,
  BarChart3,
  BellRing,
  Bike,
  Check,
  ClipboardCheck,
  HandCoins,
  MessageCircle,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { HeroMockup } from "@/components/landing/hero-mockup";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { formatLimit, PAID_PLANS, PLANS } from "@/lib/domain/plans";
import { cn } from "@/lib/utils";
import { getSession } from "@/server/context";

export const metadata: Metadata = {
  title: { absolute: "Sama Stock — La gestion de stock des commerçants sénégalais" },
};

const FEATURES = [
  {
    icon: BellRing,
    title: "Alertes avant la rupture",
    text: "Chaque produit a son seuil. Sama Stock vous prévient avant qu'il ne manque, et vous propose de réapprovisionner.",
    className: "lg:col-span-2",
  },
  {
    icon: ShoppingCart,
    title: "Caisse rapide",
    text: "Touchez, encaissez. Espèces, Wave, Orange Money, Free Money ou à crédit.",
  },
  {
    icon: Bike,
    title: "Commandes WhatsApp & Instagram",
    text: "Chaque commande réserve le stock, suit la livraison et ne se vend jamais deux fois.",
  },
  {
    icon: HandCoins,
    title: "Crédits clients",
    text: "Qui vous doit combien, depuis quand. Un rappel poli sur WhatsApp en un clic.",
    className: "lg:col-span-2",
  },
  {
    icon: ClipboardCheck,
    title: "Inventaire et pertes",
    text: "Comptez, comparez, comprenez : casse, vol et péremption enfin chiffrés.",
  },
  {
    icon: BarChart3,
    title: "Votre vrai bénéfice",
    text: "Coût moyen calculé automatiquement, marges par produit, meilleurs produits et produits qui dorment.",
  },
  {
    icon: Users,
    title: "Votre équipe, vos règles",
    text: "Gérant, vendeur, magasinier : chacun voit ce qu'il doit voir. Vos marges restent privées.",
    className: "sm:col-span-2 lg:col-span-4",
  },
];

const FAQ = [
  {
    q: "Faut-il installer quelque chose ?",
    a: "Non. Sama Stock fonctionne dans le navigateur de votre téléphone, tablette ou ordinateur. Vous pouvez l'ajouter à l'écran d'accueil comme une application.",
  },
  {
    q: "Est-ce que ça marche avec une petite connexion ?",
    a: "Oui, l'application est légère et pensée pour la 3G. Les photos sont compressées automatiquement.",
  },
  {
    q: "Mes vendeurs peuvent-ils voir mes bénéfices ?",
    a: "Non. Un vendeur enregistre les ventes et les commandes, mais ne voit jamais vos prix d'achat, vos marges ni vos rapports.",
  },
  {
    q: "Que se passe-t-il à la fin de l'essai ?",
    a: "Vos données sont conservées et le compte passe en consultation seule. Choisissez une formule pour continuer à travailler.",
  },
  {
    q: "Comment payer l'abonnement ?",
    a: "Par Wave ou Orange Money, depuis l'application. Dans cette version de démonstration, le paiement est simulé.",
  },
];

export default async function HomePage() {
  const session = await getSession();
  const primaryHref = session ? "/tableau-de-bord" : "/inscription";

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="Sama Stock, accueil">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex" aria-label="Sections">
            <a href="#fonctionnalites" className="hover:text-foreground">
              Fonctionnalités
            </a>
            <a href="#tarifs" className="hover:text-foreground">
              Tarifs
            </a>
            <a href="#faq" className="hover:text-foreground">
              Questions
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {session ? (
              <Button asChild size="sm">
                <Link href="/tableau-de-bord">
                  Mon espace <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/connexion">Connexion</Link>
                </Button>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link href="/inscription">Essai gratuit</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_65%)]"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-24">
            <div className="space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                <Sparkles className="size-3.5 text-saffron" /> Fait pour les commerçants du Sénégal
              </span>
              <h1 className="text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
                Votre stock, vos ventes et vos crédits.{" "}
                <span className="text-primary">Enfin sous contrôle.</span>
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Boutique, quincaillerie ou vente sur WhatsApp et Instagram : Sama Stock vous dit à tout moment ce qu&apos;il
                vous reste, ce que vous gagnez et qui vous doit de l&apos;argent.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" variant="saffron">
                  <Link href={primaryHref}>
                    {session ? "Ouvrir mon espace" : "Commencer l'essai gratuit"} <ArrowRight />
                  </Link>
                </Button>
                {!session && (
                  <Button asChild size="lg" variant="outline" className="bg-card">
                    <Link href="/connexion">Voir la démonstration</Link>
                  </Button>
                )}
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {["14 jours gratuits", "Sans engagement", "Wave & Orange Money"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="size-4 text-success" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <HeroMockup />
          </div>
        </section>

        {/* Pour qui */}
        <section className="border-y bg-card/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-sm font-semibold text-muted-foreground sm:px-6">
            <span className="text-foreground">Pour :</span>
            {["Boutiques de quartier", "Quincailleries", "Vendeurs WhatsApp & Instagram", "Mode et cosmétiques", "Supérettes"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </section>

        {/* Fonctionnalités */}
        <section id="fonctionnalites" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold tracking-wide text-primary uppercase">Tout au même endroit</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Fini le cahier, les oublis et les ruptures</h2>
            <p className="mt-3 text-muted-foreground">
              Sama Stock remplace le cahier de caisse, les notes WhatsApp et le calcul de tête.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text, className }, i) => (
              <article
                key={title}
                className={cn(
                  "rounded-3xl bg-card p-6 ring-1 ring-foreground/[0.07] transition-shadow hover:shadow-lg hover:shadow-primary/5",
                  i === 0 && "bg-primary text-primary-foreground ring-primary",
                  className,
                )}
              >
                <span
                  className={cn(
                    "grid size-12 place-items-center rounded-2xl bg-accent text-primary",
                    i === 0 && "bg-white/15 text-white",
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className={cn("mt-1.5 text-sm text-muted-foreground", i === 0 && "text-primary-foreground/80")}>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Sénégal */}
        <section className="bg-[#0a5a41] text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold tracking-wide text-saffron uppercase">Pensé pour ici</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Votre façon de travailler, pas l&apos;inverse</h2>
              <p className="mt-4 text-white/75">
                Les prix en FCFA, les paiements mobiles, la vente à crédit, les commandes par message : Sama Stock parle la
                langue de votre commerce.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Wallet, t: "FCFA, Wave, Orange Money, Free Money" },
                { icon: MessageCircle, t: "Reçus et rappels envoyés sur WhatsApp" },
                { icon: Smartphone, t: "Sur n'importe quel téléphone, même en 3G" },
                { icon: ShieldCheck, t: "Vos données isolées et protégées" },
              ].map(({ icon: Icon, t }) => (
                <li key={t} className="flex items-start gap-3 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                  <Icon className="mt-0.5 size-5 shrink-0 text-saffron" />
                  <span className="text-sm font-medium">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Prêt en 5 minutes</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["Créez votre compte", "Avec votre email ou Google, puis décrivez votre commerce en deux minutes."],
              ["Ajoutez vos produits", "Nom, prix, quantité et une photo prise avec votre téléphone."],
              ["Vendez et suivez", "Chaque vente met le stock à jour. Vous êtes prévenu avant la rupture."],
            ].map(([t, d], i) => (
              <li key={t} className="relative rounded-3xl bg-card p-6 ring-1 ring-foreground/[0.07]">
                <span className="num grid size-10 place-items-center rounded-full bg-saffron text-lg font-extrabold text-saffron-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="scroll-mt-20 bg-card/60 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Des prix simples, en FCFA</h2>
              <p className="mt-3 text-muted-foreground">Commencez gratuitement. Passez à une formule quand vous êtes prêt.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[PLANS.trial, ...PAID_PLANS].map((p) => {
                const featured = p.id === "business";
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "relative flex flex-col rounded-3xl bg-card p-7 ring-1 ring-foreground/[0.07]",
                      featured && "shadow-2xl shadow-primary/15 ring-2 ring-primary",
                    )}
                  >
                    {featured && (
                      <span className="absolute -top-3 left-7 rounded-full bg-saffron px-3 py-1 text-xs font-bold text-saffron-foreground">
                        Le plus complet
                      </span>
                    )}
                    <h3 className="text-lg font-bold">{p.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                    <p className="mt-5">
                      <span className="num text-4xl font-extrabold tracking-tight">{formatFCFA(p.price)}</span>
                      <span className="text-sm text-muted-foreground">{p.id === "trial" ? " pendant 14 jours" : " / mois"}</span>
                    </p>
                    <ul className="mt-6 space-y-2.5 text-sm">
                      {[
                        `${formatLimit(p.maxProducts)} produits`,
                        p.maxEmployees === 0 ? "Propriétaire seul" : `${formatLimit(p.maxEmployees)} employés`,
                        `${p.maxLocations} boutique${p.maxLocations > 1 ? "s ou dépôts" : ""}`,
                        "Caisse, commandes, crédits, inventaire",
                        ...(p.advancedReports ? ["Rapports avancés"] : []),
                      ].map((f) => (
                        <li key={f} className="flex gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="mt-8" variant={featured ? "default" : "outline"}>
                      <Link href={primaryHref}>{p.id === "trial" ? "Commencer gratuitement" : `Choisir ${p.label}`}</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Questions fréquentes</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.07] open:ring-primary/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Appel final */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(245,158,11,0.35),transparent_45%)]"
            />
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Reprenez le contrôle de votre commerce</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/80">
              14 jours pour essayer, sans rien payer. Vos données restent à vous.
            </p>
            <Button asChild size="lg" variant="saffron" className="relative mt-8">
              <Link href={primaryHref}>
                {session ? "Ouvrir mon espace" : "Créer mon compte gratuitement"} <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} Sama Stock · Fait avec soin au Sénégal</p>
        </div>
      </footer>
    </div>
  );
}

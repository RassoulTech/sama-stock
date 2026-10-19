import {
  ArrowRight,
  BellRing,
  Check,
  Clock,
  CreditCard,
  Lock,
  Minus,
  PlayCircle,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { EmailSignup } from "@/components/landing/email-signup";
import { LossCalculator } from "@/components/landing/loss-calculator";
import { ProductVideo } from "@/components/landing/product-video";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { StickyCta } from "@/components/landing/sticky-cta";
import {
  CreditVisual,
  DashboardPreview,
  OrderVisual,
  PosVisual,
  ReportVisual,
  StockAlertToast,
  TeamVisual,
  WhatsAppReceipt,
} from "@/components/landing/visuals";
import { formatLimit, PAID_PLANS, PLANS } from "@/lib/domain/plans";
import { cn } from "@/lib/utils";
import { getSession } from "@/server/context";

export const metadata: Metadata = {
  title: { absolute: "Sama Stock — Arrêtez de perdre de l'argent dans votre commerce" },
  description:
    "Stock, caisse, commandes WhatsApp et Instagram, crédits clients : Sama Stock suit tout et vous prévient avant la rupture. 14 jours gratuits, sans carte bancaire.",
};

const LEGAL = {
  editor: "Dione Mouhamed, entreprise individuelle",
  ninea: "013218369",
  rccm: "SN.THS.2026.A.4360",
  city: "Thiès, Sénégal",
};

const FEATURES = [
  {
    kicker: "Caisse",
    title: "Encaissez en trois touches, envoyez le reçu sur WhatsApp",
    text: "Espèces, Wave, Orange Money ou à crédit. Le stock baisse tout seul, le reçu part chez le client en un clic.",
    points: ["Monnaie rendue calculée", "Paiement partiel et crédit", "Reçu imprimable"],
    visual: <PosVisual />,
  },
  {
    kicker: "Commandes en ligne",
    title: "Les commandes WhatsApp et Instagram, enfin sous contrôle",
    text: "Chaque commande réserve ses produits : vous ne vendez plus deux fois le même article. Suivez-la jusqu'à la livraison et au paiement.",
    points: ["Réservation automatique du stock", "Suivi : préparation, livraison, livrée", "Récapitulatif envoyé au client"],
    visual: <OrderVisual />,
  },
  {
    kicker: "Crédits clients",
    title: "Plus aucun crédit oublié",
    text: "Qui vous doit combien, depuis quand. Un rappel poli part sur WhatsApp en un clic, et chaque remboursement est noté.",
    points: ["Dette calculée automatiquement", "Rappel WhatsApp prêt à envoyer", "Historique par client"],
    visual: <CreditVisual />,
  },
];

const BENTO = [
  {
    title: "Vos vendeurs ne voient jamais vos marges",
    text: "Gérant, vendeur, magasinier : chacun a ses droits. Les prix d'achat et les bénéfices restent entre vous et vous.",
    visual: <TeamVisual />,
  },
  {
    title: "Votre vrai bénéfice, produit par produit",
    text: "Coût moyen calculé à chaque achat, meilleurs produits, produits qui dorment, pertes chiffrées.",
    visual: <ReportVisual />,
  },
];

const COMPARISON: [string, string | boolean, string | boolean, string | boolean][] = [
  ["Savoir ce qu'il reste, à tout moment", false, "Si c'est à jour", true],
  ["Alerte avant la rupture", false, false, true],
  ["Reçu envoyé sur WhatsApp", false, false, true],
  ["Commandes en ligne réservées", false, false, true],
  ["Suivi et rappel des crédits", "Au crayon", "Manuel", true],
  ["Vendeurs sans accès à vos marges", false, false, true],
  ["Bénéfice réel calculé", false, "Formules à faire", true],
  ["Sur le téléphone, partout", false, "Difficile", true],
];

const FAQ = [
  {
    q: "Je ne suis pas à l'aise avec l'informatique. C'est compliqué ?",
    a: "Non. Si vous savez envoyer un message WhatsApp, vous savez utiliser Sama Stock. Le démarrage guidé prend deux minutes, et un commerce de démonstration vous montre tout.",
  },
  {
    q: "Faut-il installer quelque chose ou acheter du matériel ?",
    a: "Rien du tout. Sama Stock fonctionne dans le navigateur de votre téléphone, tablette ou ordinateur. Vous pouvez l'ajouter à l'écran d'accueil comme une application.",
  },
  {
    q: "Mes vendeurs peuvent-ils voir mes bénéfices ?",
    a: "Non. Un vendeur enregistre les ventes et les commandes, mais ne voit jamais vos prix d'achat, vos marges ni vos rapports. C'est vérifié par le serveur, pas seulement caché à l'écran.",
  },
  {
    q: "Est-ce que ça marche avec une petite connexion ?",
    a: "Oui. L'application est légère, pensée pour la 3G, et les photos sont compressées automatiquement.",
  },
  {
    q: "Mes données sont-elles en sécurité ?",
    a: "Chaque commerce ne voit que ses propres données. Les échanges sont chiffrés et les mots de passe ne sont jamais stockés en clair.",
  },
  {
    q: "Et si j'arrête après l'essai ?",
    a: "Rien à payer, rien à résilier. Vos données sont conservées et le compte passe en consultation seule : vous reprenez quand vous voulez.",
  },
  {
    q: "Comment payer l'abonnement ?",
    a: "Par Wave ou Orange Money, directement depuis l'application. Dans cette version de démonstration, le paiement est simulé.",
  },
];

function SectionTitle({ kicker, title, text, className }: { kicker: string; title: React.ReactNode; text?: string; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">{kicker}</p>
      <h2 className="mt-3 text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance sm:text-[2.5rem]">{title}</h2>
      {text && <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">{text}</p>}
    </div>
  );
}

function Mark({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto size-5 text-primary" aria-label="Oui" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="Non" />;
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

export default async function HomePage() {
  const session = await getSession();
  const signupHref = session ? "/tableau-de-bord" : "/inscription";

  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      {/* Bandeau de garanties */}
      <div className="bg-[#0a3d2d] px-4 py-2 text-center text-[0.8125rem] text-white/85">
        <span className="font-medium text-white">14 jours gratuits</span> · sans carte bancaire
        <span className="hidden sm:inline"> · prêt en 5 minutes</span>
      </div>

      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
        <div className="mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl border bg-background/85 px-3 shadow-[0_8px_30px_-12px_rgb(11_19_16/0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-4">
          <Link href="/" aria-label="Sama Stock, accueil" className="justify-self-start">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex" aria-label="Sections">
            {[
              ["#fonctionnalites", "Fonctionnalités"],
              ["#calcul", "Vos pertes"],
              ["#tarifs", "Tarifs"],
              ["#faq", "Questions"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3.5 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 justify-self-end">
            {session ? (
              <Link
                href="/tableau-de-bord"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-[#095f44]"
              >
                Mon espace <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link href="/connexion" className="hidden h-9 items-center px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
                  Connexion
                </Link>
                <Link
                  href="/inscription"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  Essai gratuit
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] bg-[radial-gradient(60%_50%_at_70%_10%,rgb(11_110_79/0.10),transparent_70%),radial-gradient(40%_40%_at_10%_20%,rgb(245_158_11/0.08),transparent_70%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] [background-image:linear-gradient(rgb(11_19_16/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(11_19_16/0.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pt-20 lg:pb-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-[0_1px_2px_rgb(11_19_16/0.04)]">
                <span className="size-1.5 rounded-full bg-primary" />
                Boutiques, quincailleries et vendeurs en ligne du Sénégal
              </p>
              <h1 className="mt-6 text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-[3.5rem] lg:text-[4rem]">
                Votre commerce perd de l&apos;argent chaque jour.{" "}
                <span className="font-display font-normal tracking-[-0.01em] text-primary italic">Plus maintenant.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[1.125rem] leading-relaxed text-muted-foreground">
                Ruptures de stock, crédits oubliés, marchandise qui disparaît : Sama Stock suit tout, en boutique comme sur
                WhatsApp et Instagram, et vous prévient avant qu&apos;il ne soit trop tard.
              </p>
              <div className="mt-8">
                {session ? (
                  <Link
                    href="/tableau-de-bord"
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-saffron px-6 text-[0.9375rem] font-semibold text-saffron-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] hover:bg-[#ec9708]"
                  >
                    Ouvrir mon espace <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <EmailSignup />
                )}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {["Sans carte bancaire", "Sans engagement", "Prêt en 5 minutes"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-primary" /> {t}
                  </span>
                ))}
              </div>
              {!session && (
                <Link href="/demo" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary">
                  <PlayCircle className="size-5 text-primary" /> Voir un commerce de démonstration, sans inscription
                </Link>
              )}
            </div>

            <div className="relative">
              <DashboardPreview />
              <StockAlertToast className="absolute -top-7 -left-4 hidden sm:flex lg:-left-14" />
              <WhatsAppReceipt className="absolute -right-3 -bottom-12 hidden rotate-2 sm:block lg:-right-8" />
            </div>
          </div>
        </section>

        {/* ── Vidéo de présentation ── */}
        <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-24">
          <ProductVideo />
        </section>

        {/* ── Bandeau de confiance ── */}
        <section className="border-y bg-card/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row">
            <p>
              Pour <span className="font-medium text-foreground">les boutiques, quincailleries, supérettes et vendeurs WhatsApp</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {(
                [
                  ["Espèces", null],
                  ["Wave", "wave"],
                  ["Orange Money", "orange_money"],
                  ["Crédit", null],
                ] as const
              ).map(([label, logo]) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {logo && <PaymentLogo method={logo} className="size-4 rounded-[4px]" />}
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Le problème ── */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionTitle
            kicker="Ce que le cahier ne vous dit pas"
            title={
              <>
                L&apos;argent ne disparaît pas d&apos;un coup.{" "}
                <span className="font-display font-normal tracking-normal italic">Il fuit, un peu chaque jour.</span>
              </>
            }
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "Le client qui repart les mains vides",
                text: "Le produit était en rupture et personne ne l'avait vu. Ce client achète maintenant ailleurs.",
              },
              {
                icon: CreditCard,
                title: "Le crédit que personne ne réclame",
                text: "« Je passe payer demain. » Trois semaines plus tard, plus personne ne se souvient du montant.",
              },
              {
                icon: Lock,
                title: "Les sacs qui ont disparu",
                text: "Casse, vol, erreur : sans inventaire, la perte reste invisible jusqu'à la fin du mois.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="reveal surface p-6">
                <span className="grid size-10 place-items-center rounded-lg bg-destructive/8 text-destructive ring-1 ring-destructive/15 ring-inset">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-[1.0625rem] font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Calculateur ── */}
        <section id="calcul" className="scroll-mt-24 bg-[#f1f4f2] py-24 dark:bg-card/40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle
              kicker="Faites le calcul"
              title="Combien votre commerce perd-il chaque mois ?"
              text="Bougez les curseurs avec vos propres chiffres. Le résultat parle de lui-même."
            />
            <div className="reveal mt-12">
              <LossCalculator />
            </div>
          </div>
        </section>

        {/* ── Fonctionnalités ── */}
        <section id="fonctionnalites" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
          <SectionTitle
            kicker="Tout au même endroit"
            title={
              <>
                Une seule application pour <span className="font-display font-normal tracking-normal italic">tout votre commerce.</span>
              </>
            }
            text="Elle remplace le cahier de caisse, les notes WhatsApp et le calcul de tête."
          />
          <div className="mt-20 space-y-24">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={cn("reveal", i % 2 === 1 && "lg:order-2")}>
                  <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">{f.kicker}</p>
                  <h3 className="mt-3 text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance">{f.title}</h3>
                  <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">{f.text}</p>
                  <ul className="mt-6 space-y-2.5">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-center gap-2.5 text-[0.9375rem]">
                        <span className="grid size-5 place-items-center rounded-full bg-accent text-primary">
                          <Check className="size-3" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="reveal rounded-2xl border bg-[linear-gradient(180deg,#f6f8f7,#eef2ef)] p-6 sm:p-8 dark:bg-card">
                  {f.visual}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-24 grid gap-4 md:grid-cols-2">
            {BENTO.map((b) => (
              <div key={b.title} className="reveal surface overflow-hidden">
                <div className="p-6 pb-0 sm:p-8 sm:pb-0">
                  <h3 className="text-xl font-semibold tracking-tight">{b.title}</h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{b.text}</p>
                </div>
                <div className="mt-6 bg-[linear-gradient(180deg,#f6f8f7,#eef2ef)] p-6 sm:p-8 dark:bg-muted/40">{b.visual}</div>
              </div>
            ))}
            <div className="reveal surface flex flex-col justify-between gap-6 p-6 sm:p-8 md:col-span-2 md:flex-row md:items-center">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-saffron/15 text-warning ring-1 ring-saffron/30 ring-inset">
                  <BellRing className="size-5" />
                </span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">Alerté avant la rupture, pas après</h3>
                  <p className="mt-1.5 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
                    Chaque produit a son seuil. Dès qu&apos;il est atteint, Sama Stock vous le dit et prépare le
                    réapprovisionnement. Inventaire, pertes, transferts entre boutiques : tout est tracé.
                  </p>
                </div>
              </div>
              <StockAlertToast className="shrink-0 shadow-none md:w-72" />
            </div>
          </div>
        </section>

        {/* ── Comparaison ── */}
        <section className="border-y bg-card/60 py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <SectionTitle kicker="Comparez" title="Le cahier, Excel ou Sama Stock ?" />
            <div className="reveal mt-12 overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(11_19_16/0.04)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium sm:px-6">
                      <span className="sr-only">Fonction</span>
                    </th>
                    <th className="w-20 px-2 py-3 font-medium sm:w-28">Cahier</th>
                    <th className="w-20 px-2 py-3 font-medium sm:w-28">Excel</th>
                    <th className="w-24 bg-accent px-2 py-3 font-semibold text-accent-foreground sm:w-32">Sama Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(([label, a, b, c]) => (
                    <tr key={label} className="border-b last:border-0">
                      <td className="px-4 py-3.5 sm:px-6">{label}</td>
                      <td className="px-2 text-center">
                        <Mark value={a} />
                      </td>
                      <td className="px-2 text-center">
                        <Mark value={b} />
                      </td>
                      <td className="bg-accent/50 px-2 text-center">
                        <Mark value={c} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Démarrage ── */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionTitle kicker="Prêt en 5 minutes" title="Trois étapes, et votre commerce est sous contrôle" />
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              ["Créez votre compte", "Avec votre email, en trente secondes. Aucune carte bancaire."],
              ["Ajoutez vos produits", "Nom, prix, quantité, et une photo prise avec votre téléphone."],
              ["Vendez, suivez, encaissez", "Chaque vente met le stock à jour. Vous êtes prévenu avant la rupture."],
            ].map(([t, d], i) => (
              <li key={t} className="reveal surface p-6">
                <span className="num text-sm font-semibold text-primary">0{i + 1}</span>
                <h3 className="mt-3 text-[1.0625rem] font-semibold tracking-tight">{t}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-center">
            <Link
              href={signupHref}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-saffron px-6 text-[0.9375rem] font-semibold text-saffron-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_24px_-8px_rgb(245_158_11/0.55)] hover:bg-[#ec9708]"
            >
              Créer mon compte gratuitement <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        {/* ── Tarifs ── */}
        <section id="tarifs" className="scroll-mt-24 bg-[#f1f4f2] py-24 dark:bg-card/40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle
              kicker="Tarifs"
              title="Moins cher qu'un seul crédit oublié"
              text="Commencez gratuitement. Choisissez une formule seulement si Sama Stock vous fait gagner de l'argent."
            />
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[PLANS.trial, ...PAID_PLANS].map((p) => {
                const featured = p.id === "pro";
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "reveal relative flex flex-col rounded-2xl border bg-card p-7",
                      featured && "border-primary shadow-[0_0_0_1px_var(--primary),0_24px_48px_-24px_rgb(11_110_79/0.45)]",
                    )}
                  >
                    {featured && (
                      <span className="absolute -top-3 left-7 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                        Recommandé pour démarrer
                      </span>
                    )}
                    <h3 className="text-[1.0625rem] font-semibold">{p.label}</h3>
                    <p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.tagline}</p>
                    <p className="mt-6 flex items-baseline gap-1.5">
                      <span className="num text-[2.5rem] leading-none font-semibold tracking-[-0.04em]">
                        {p.price.toLocaleString("fr-FR")}
                      </span>
                      <span className="text-sm text-muted-foreground">{p.id === "trial" ? "FCFA · 14 jours" : "FCFA / mois"}</span>
                    </p>
                    <ul className="mt-7 space-y-3 text-sm">
                      {[
                        `${formatLimit(p.maxProducts)} produits`,
                        p.maxEmployees === 0 ? "Propriétaire seul" : `${formatLimit(p.maxEmployees)} employés`,
                        `${p.maxLocations} boutique${p.maxLocations > 1 ? "s ou dépôts" : ""}`,
                        "Caisse, commandes, crédits, inventaire",
                        p.advancedReports ? "Rapports avancés" : "Rapports avancés non inclus",
                      ].map((f) => (
                        <li key={f} className={cn("flex gap-2.5", f.endsWith("non inclus") && "text-muted-foreground")}>
                          {f.endsWith("non inclus") ? (
                            <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                          ) : (
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          )}
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={signupHref}
                      className={cn(
                        "mt-8 inline-flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                        featured
                          ? "bg-primary text-primary-foreground hover:bg-[#095f44]"
                          : "border bg-card hover:bg-muted",
                      )}
                    >
                      {p.id === "trial" ? "Commencer l'essai gratuit" : `Essayer ${p.label} gratuitement`}
                    </Link>
                  </div>
                );
              })}
            </div>
            <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" /> Chaque formule commence par 14 jours gratuits, sans carte
              bancaire.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-24 sm:px-6">
          <SectionTitle kicker="Questions fréquentes" title="Vous hésitez encore ?" />
          <div className="mt-12 divide-y rounded-2xl border bg-card">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[0.9375rem] font-medium">
                  {q}
                  <span className="grid size-6 shrink-0 place-items-center rounded-md border text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="-mt-1 pb-5 text-[0.9375rem] leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Appel final ── */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#0a3d2d] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_15%_0%,rgb(245_158_11/0.28),transparent_70%),radial-gradient(40%_50%_at_90%_100%,rgb(39_168_124/0.35),transparent_70%)]"
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
                Chaque jour sans suivi est un jour de pertes.{" "}
                <span className="font-display font-normal tracking-normal text-saffron italic">Commencez aujourd&apos;hui.</span>
              </h2>
              <p className="mt-5 text-[1.0625rem] text-white/75">
                14 jours gratuits, sans carte bancaire. En cinq minutes, votre stock est sous contrôle.
              </p>
              <div className="mt-8 flex justify-center">
                {session ? (
                  <Link
                    href="/tableau-de-bord"
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-saffron px-6 font-semibold text-saffron-foreground"
                  >
                    Ouvrir mon espace <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <EmailSignup tone="dark" cta="Créer mon compte" />
                )}
              </div>
              <p className="mt-5 flex items-center justify-center gap-2 text-sm text-white/60">
                <Smartphone className="size-4" /> Fonctionne sur téléphone, tablette et ordinateur
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-sm text-muted-foreground">
              La gestion de stock, de caisse et de crédits des commerçants sénégalais, en boutique comme en ligne.
            </p>
          </div>
          <div className="space-y-2.5">
            <p className="font-medium">Produit</p>
            <a href="#fonctionnalites" className="block text-muted-foreground hover:text-foreground">
              Fonctionnalités
            </a>
            <a href="#tarifs" className="block text-muted-foreground hover:text-foreground">
              Tarifs
            </a>
            <Link href="/demo" className="block text-muted-foreground hover:text-foreground">
              Démonstration
            </Link>
          </div>
          <div className="space-y-2.5">
            <p className="font-medium">Compte</p>
            <Link href="/inscription" className="block text-muted-foreground hover:text-foreground">
              Essai gratuit
            </Link>
            <Link href="/connexion" className="block text-muted-foreground hover:text-foreground">
              Connexion
            </Link>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
            <p>
              © {new Date().getFullYear()} Sama Stock · Édité par {LEGAL.editor} · {LEGAL.city}
            </p>
            <p className="num">
              NINEA {LEGAL.ninea} · RCCM {LEGAL.rccm}
            </p>
          </div>
        </div>
      </footer>

      {!session && <StickyCta href="/inscription" />}
    </div>
  );
}

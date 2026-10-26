import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Check,
  Clock,
  CreditCard,
  FlaskConical,
  GraduationCap,
  KeyRound,
  Lock,
  Minus,
  Mail,
  MessageCircle,
  Palette,
  Phone,
  PlayCircle,
  Presentation,
  Scale,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BrandShowcase } from "@/components/landing/brand-showcase";
import { LossCalculator } from "@/components/landing/loss-calculator";
import { PricingTabs } from "@/components/landing/pricing-tabs";
import { ProductVideo } from "@/components/landing/product-video";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { MobileMenu } from "@/components/landing/mobile-menu";
import { DemoButton } from "@/components/demo/demo-button";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { Segments, SegmentsMarquee } from "@/components/landing/segments";
import { ThemeToggle } from "@/components/theme-toggle";
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
import {
  LICENSE_ORDER,
  LICENSE_PACKS,
  limitLabel,
  MAINTENANCE_INCLUDED_MONTHS,
  PAID_PLANS,
  PLANS,
  type LicensePackId,
} from "@/lib/domain/plans";
import { formatFCFA } from "@/lib/format";
import { LEGAL, LEGAL_PAGES } from "@/lib/legal";
import { pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { INSTALL_MESSAGE, salesLink } from "@/lib/whatsapp";
import { getSession } from "@/server/context";

export const metadata: Metadata = pageMetadata({
  title: "Sama Stock — Votre application de gestion, à vous pour toujours",
  description:
    "Stock, caisse, commandes en ligne et crédits clients. Achetée une fois, installée chez vous à votre nom, avec votre logo et vos produits. Pour les commerçants du Sénégal.",
  path: "/",
  absoluteTitle: true,
});

const SECTIONS = [
  ["#comment", "Comment ça marche"],
  ["#fonctionnalites", "Fonctionnalités"],
  ["#tarifs", "Tarifs"],
  ["/demo", "Démo"],
  ["#faq", "Questions"],
] as const;

const INSTALL_HREF = salesLink(INSTALL_MESSAGE);

/** Message WhatsApp prêt à envoyer pour un forfait précis. */
const packHref = (id: LicensePackId) =>
  salesLink(
    `Bonjour Sama Stock, je suis intéressé(e) par la licence ${LICENSE_PACKS[id].label} (${formatFCFA(LICENSE_PACKS[id].price)}). Pouvez-vous me contacter pour une démonstration et l'installation ?`,
  );

/** Le parcours d'un nouveau client, de la démonstration à l'application qui lui appartient. */
const STEPS = [
  {
    icon: Presentation,
    title: "On vous montre",
    text: "Une démonstration gratuite, dans votre boutique ou sur WhatsApp, avec vos questions et vos produits.",
  },
  {
    icon: Palette,
    title: "On l'installe à votre nom",
    text: "Votre nom, votre logo et vos couleurs. Vos produits sont importés depuis votre cahier ou votre fichier Excel.",
  },
  {
    icon: GraduationCap,
    title: "On vous forme",
    text: "Vous et vos vendeurs, sur place, jusqu'à ce que tout le monde soit à l'aise.",
  },
  {
    icon: KeyRound,
    title: "Elle est à vous",
    text: `Vous payez une fois, en deux fois si vous voulez. ${MAINTENANCE_INCLUDED_MONTHS} mois d'assistance sont compris.`,
  },
];

const TRUST = [
  {
    icon: BadgeCheck,
    title: "Entreprise immatriculée au Sénégal",
    text: `NINEA ${LEGAL.ninea} · RCCM ${LEGAL.rccm}. Un éditeur identifié, basé à Thiès.`,
  },
  {
    icon: Lock,
    title: "Paiements sécurisés",
    text: "Wave, Orange Money ou espèces, avec une facture à votre nom pour chaque paiement. Nous ne voyons jamais votre code secret.",
  },
  {
    icon: ShieldCheck,
    title: "Données protégées",
    text: "Connexion chiffrée, mots de passe chiffrés, hébergement professionnel en Europe.",
  },
  {
    icon: Scale,
    title: "Conforme à la loi sénégalaise",
    text: "Loi n° 2008-12 sur les données personnelles. Vos données vous appartiennent, jamais revendues.",
  },
];

const FEATURES = [
  {
    kicker: "Caisse",
    title: "Encaissez en trois touches, envoyez le reçu sur WhatsApp",
    text: "Espèces, Wave, Orange Money ou à crédit. Le stock baisse tout seul, le reçu PDF part chez le client en un clic.",
    points: ["Monnaie rendue calculée", "Paiement partiel et crédit", "Reçu, devis et facture en PDF"],
    visual: <PosVisual />,
  },
  {
    kicker: "Commandes en ligne",
    title: "Vos commandes en ligne, enfin sous contrôle",
    text: "WhatsApp, Instagram, TikTok, Facebook ou votre site : chaque commande réserve ses produits, vous ne vendez plus deux fois le même article. Suivez-la jusqu'à la livraison et au paiement.",
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
  ["À votre nom, avec votre logo", false, false, true],
  ["Installé et expliqué chez vous", false, false, true],
  ["Savoir ce qu'il reste, à tout moment", false, "Si c'est à jour", true],
  ["Alerte avant la rupture", false, false, true],
  ["Reçus, devis et factures PDF sur WhatsApp", false, false, true],
  ["Commandes en ligne réservées", false, false, true],
  ["Suivi et rappel des crédits", "Au crayon", "Manuel", true],
  ["Vendeurs sans accès à vos marges", false, false, true],
  ["Bénéfice réel calculé", false, "Formules à faire", true],
  ["Sur le téléphone, partout", false, "Difficile", true],
];

const FAQ = [
  {
    q: "L'application est-elle vraiment à moi ?",
    a: "Oui. Vous la payez une seule fois, elle porte votre nom et votre logo, et elle ne s'arrête jamais. Vos données vous appartiennent : vous pouvez les exporter dans Excel à tout moment.",
  },
  {
    q: "Que comprend le prix ?",
    a: `L'installation à votre nom, votre logo et vos couleurs, l'import de vos produits, la formation de votre équipe et ${MAINTENANCE_INCLUDED_MONTHS} mois d'assistance (questions, nouveautés, sauvegardes).`,
  },
  {
    q: "Et après la première année ?",
    a: `La maintenance devient facultative : de ${formatFCFA(LICENSE_PACKS.boutique.maintenancePrice)} à ${formatFCFA(LICENSE_PACKS.business.maintenancePrice)} par an selon votre forfait. Sans elle, votre application continue de fonctionner normalement.`,
  },
  {
    q: "Puis-je payer en plusieurs fois ?",
    a: "Oui : un acompte à la commande et le reste à l'installation, par Wave, Orange Money ou en espèces. Vous recevez une facture à votre nom.",
  },
  {
    q: "Je ne suis pas à l'aise avec l'informatique. C'est compliqué ?",
    a: "Non. Nous installons tout et nous vous formons sur place. Si vous savez envoyer un message WhatsApp, vous savez utiliser Sama Stock.",
  },
  {
    q: "Faut-il un ordinateur ou du matériel ?",
    a: "Non. Votre téléphone suffit ; elle marche aussi sur tablette et ordinateur. Il faut une connexion internet, même faible : l'application est pensée pour la 3G. Vos données sont sauvegardées en ligne, donc rien n'est perdu si vous changez de téléphone.",
  },
  {
    q: "Mes vendeurs peuvent-ils voir mes bénéfices ?",
    a: "Non. Un vendeur enregistre les ventes et les commandes, mais ne voit jamais vos prix d'achat, vos marges ni vos rapports. C'est vérifié par le serveur, pas seulement caché à l'écran.",
  },
  {
    q: "Puis-je essayer avant d'acheter ?",
    a: "Oui : la démo en ligne vous montre tout, sans inscription. Vous pouvez aussi commencer seul avec 14 jours d'essai gratuit, puis un abonnement mensuel sans engagement si vous préférez payer au mois.",
  },
];

function SectionTitle({ kicker, title, text, className }: { kicker: string; title: React.ReactNode; text?: string; className?: string }) {
  return (
    <div className={cn("reveal mx-auto max-w-2xl text-center", className)}>
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

/** Pastille de l'accroche : l'application porte le nom, le logo et les couleurs du commerçant (exemple fictif). */
function BrandChip({ className }: { className?: string }) {
  return (
    <div className={cn("items-center gap-3 rounded-2xl border bg-card p-3 pr-4 shadow-[0_16px_40px_-16px_rgb(11_19_16/0.35)]", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1e3a8a] text-xs font-bold text-white">QN</span>
      <span>
        <span className="block text-sm font-semibold">Quincaillerie Ndiaye</span>
        <span className="block text-[11px] text-muted-foreground">Votre nom, votre logo, vos couleurs</span>
        <span className="mt-1.5 flex gap-1" aria-hidden>
          {["#1d4ed8", "#0b6e4f", "#9f1239", "#6d28d9", "#c2410c"].map((c) => (
            <span key={c} className="size-3 rounded-full ring-1 ring-black/5" style={{ backgroundColor: c }} />
          ))}
        </span>
      </span>
    </div>
  );
}

/** Données structurées : uniquement des informations visibles sur la page (aucun avis ni note inventés). */
function structuredData() {
  const logo = `${SITE_URL}/icon-512.png`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organisation`,
        name: SITE_NAME,
        url: SITE_URL,
        logo,
        email: LEGAL.email,
        address: { "@type": "PostalAddress", addressLocality: "Thiès", addressCountry: "SN" },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: "fr",
        publisher: { "@id": `${SITE_URL}/#organisation` },
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_URL,
        image: logo,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web (téléphone, tablette, ordinateur)",
        description:
          "Gestion de stock, caisse, commandes en ligne et crédits clients pour les boutiques, e-commerçants et entrepreneurs du Sénégal.",
        publisher: { "@id": `${SITE_URL}/#organisation` },
        offers: [
          ...LICENSE_ORDER.map((id) => ({
            "@type": "Offer",
            name: `Licence ${LICENSE_PACKS[id].label} (paiement unique)`,
            price: LICENSE_PACKS[id].price,
            priceCurrency: "XOF",
            url: `${SITE_URL}/#tarifs`,
          })),
          ...[PLANS.trial, ...PAID_PLANS].map((p) => ({
            "@type": "Offer",
            name: `Abonnement ${p.label}`,
            price: p.price,
            priceCurrency: "XOF",
            url: `${SITE_URL}/#tarifs`,
          })),
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

export default async function HomePage() {
  const session = await getSession();
  const signupHref = session ? "/tableau-de-bord" : "/inscription";

  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      {/* Bandeau de garanties */}
      <div className="bg-[#0a3d2d] px-4 py-2 text-center text-[0.8125rem] text-white/85">
        <span className="font-medium text-white">Payée une fois, à vous pour toujours</span> · installée chez vous
        <span className="hidden sm:inline"> · à votre nom et à vos couleurs</span>
      </div>

      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
        <div className="enter relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-2xl border bg-background/85 px-3 shadow-[0_8px_30px_-12px_rgb(11_19_16/0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-4 xl:grid xl:grid-cols-[1fr_auto_1fr]">
          <Link href="/" aria-label="Sama Stock, accueil" className="shrink-0 justify-self-start">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground xl:flex" aria-label="Sections">
            {SECTIONS.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-1.5 whitespace-nowrap transition-colors hover:bg-muted hover:text-foreground xl:px-3.5"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 justify-self-end">
            <ThemeToggle className="hidden sm:inline-flex" />
            {session ? (
              <Link
                href="/tableau-de-bord"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium whitespace-nowrap text-primary-foreground hover:bg-[#095f44]"
              >
                Mon espace <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link href="/connexion" className="hidden h-9 items-center px-3 text-sm font-medium text-muted-foreground hover:text-foreground xl:inline-flex">
                  Connexion
                </Link>
                <a
                  href={INSTALL_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-sm font-medium whitespace-nowrap text-background transition-opacity hover:opacity-90"
                >
                  <MessageCircle className="size-4" />
                  <span className="sm:hidden">Contact</span>
                  <span className="hidden sm:inline">Demander une installation</span>
                </a>
              </>
            )}
            <MobileMenu sections={SECTIONS} loggedIn={Boolean(session)} whatsappHref={INSTALL_HREF} />
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
              <p className="enter inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-[0_1px_2px_rgb(11_19_16/0.04)] [--enter-delay:80ms]">
                <span className="size-1.5 rounded-full bg-primary" />
                Boutiques, quincailleries et e-commerçants du Sénégal
              </p>
              <h1 className="enter mt-6 text-[2.75rem] [--enter-delay:160ms] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-[3.5rem] lg:text-[4rem]">
                Votre propre application de gestion.{" "}
                <span className="font-display font-normal tracking-[-0.01em] text-primary italic">Payée une fois, à vous pour toujours.</span>
              </h1>
              <p className="enter mt-6 max-w-xl text-[1.125rem] leading-relaxed text-muted-foreground [--enter-delay:280ms]">
                Stock, caisse, commandes WhatsApp et crédits clients au même endroit. Nous l&apos;installons chez vous, à votre
                nom, avec votre logo et vos produits. Pas d&apos;abonnement à payer chaque mois.
              </p>
              <div className="enter mt-8 flex flex-wrap gap-3 [--enter-delay:380ms]">
                {session ? (
                  <Link
                    href="/tableau-de-bord"
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-saffron px-6 text-[0.9375rem] font-semibold text-saffron-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] hover:bg-[#ec9708]"
                  >
                    Ouvrir mon espace <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <a
                    href={INSTALL_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-saffron px-6 text-[0.9375rem] font-semibold text-saffron-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_24px_-8px_rgb(245_158_11/0.55)] hover:bg-[#ec9708]"
                  >
                    <MessageCircle className="size-[1.125rem]" /> Demander une installation
                  </a>
                )}
                <Link
                  href="/demo"
                  className="inline-flex h-12 items-center gap-2 rounded-lg border bg-card px-5 text-[0.9375rem] font-semibold transition-colors hover:bg-muted"
                >
                  <FlaskConical className="size-[1.125rem] text-primary" /> Voir la démo
                </Link>
              </div>
              <div className="enter mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground [--enter-delay:460ms]">
                {["Installée chez vous", "À votre nom", "Paiement en 2 fois"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-primary" /> {t}
                  </span>
                ))}
              </div>
              {!session && (
                <div className="enter mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 [--enter-delay:540ms]">
                  <a href="#presentation" className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary">
                    <PlayCircle className="size-5 text-primary" /> Voir Sama Stock en action (35 s)
                  </a>
                  <a href="#tarifs" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
                    Ou essayez seul, 14 jours gratuits <ArrowRight className="size-4" />
                  </a>
                </div>
              )}
            </div>

            <div className="enter-pop relative [--enter-delay:240ms]">
              <DashboardPreview />
              <BrandChip className="enter-float absolute -top-8 -left-4 hidden [--enter-delay:900ms] sm:flex lg:-left-14" />
              <WhatsAppReceipt className="enter-float absolute -right-3 -bottom-12 hidden rotate-2 [--enter-delay:1150ms] sm:block lg:-right-8" />
            </div>
          </div>
        </section>

        {/* ── Vidéo de présentation ── */}
        <section id="presentation" className="reveal mx-auto max-w-6xl scroll-mt-24 px-4 pt-20 pb-16 sm:px-6 sm:pt-24">
          <ProductVideo />
        </section>

        {/* ── Bandeau de confiance ── */}
        <section className="border-y bg-card/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row">
            <p>
              Pour <span className="font-medium text-foreground">les boutiques physiques, e-commerçants, vendeurs en ligne et entrepreneurs</span>
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

        {/* ── Comment ça marche ── */}
        <section id="comment" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
          <SectionTitle
            kicker="Comment ça marche"
            title={
              <>
                On s&apos;occupe de tout.{" "}
                <span className="font-display font-normal tracking-normal italic">Vous gardez l&apos;application.</span>
              </>
            }
            text="Pas de logiciel compliqué à installer seul, pas de facture chaque mois : nous venons, nous installons, nous vous formons."
          />
          <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="reveal surface relative grid grid-cols-[auto_1fr] gap-x-4 p-5 sm:block sm:p-6">
                <span className="num absolute top-5 right-5 text-sm font-semibold text-muted-foreground/50">0{i + 1}</span>
                <span className="row-span-2 grid size-11 place-items-center rounded-xl bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="pr-8 text-[1.0625rem] font-semibold tracking-tight sm:mt-5 sm:pr-0">{title}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground sm:mt-2">{text}</p>
              </li>
            ))}
          </ol>
          <div className="reveal mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href={INSTALL_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-[0.9375rem] font-semibold text-primary-foreground hover:bg-[#095f44]"
            >
              <MessageCircle className="size-[1.125rem]" /> Demander une démonstration
            </a>
            <a href={`tel:+${LEGAL.whatsapp}`} className="inline-flex h-12 items-center gap-2 px-4 text-sm font-medium text-muted-foreground hover:text-foreground">
              <Phone className="size-4" /> Ou appelez le {LEGAL.phone.replace("+221 ", "")}
            </a>
          </div>
        </section>

        {/* ── À votre image ── */}
        <section className="overflow-hidden border-y bg-[#f1f4f2] py-24 dark:bg-card/40">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="reveal">
              <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">À votre image</p>
              <h2 className="mt-3 text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance sm:text-[2.5rem]">
                Ce n&apos;est pas « une application ». <span className="font-display font-normal tracking-normal italic">C&apos;est la vôtre.</span>
              </h2>
              <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
                Votre nom en haut de l&apos;écran, votre logo sur les reçus, vos couleurs partout : vos vendeurs et vos clients
                voient votre commerce, pas le nôtre.
              </p>
              <ul className="mt-6 space-y-2.5">
                {["Votre nom et votre logo", "La couleur de votre choix", "Vos produits déjà enregistrés", "Reçus WhatsApp à votre nom"].map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-[0.9375rem]">
                    <span className="grid size-5 place-items-center rounded-full bg-accent text-primary">
                      <Check className="size-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <BrandShowcase />
          </div>
        </section>

        {/* ── Pour qui ── */}
        <section id="pour-qui" className="scroll-mt-24 overflow-hidden py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle
              kicker="Pour qui ?"
              title="En boutique, en ligne, ou les deux"
              text="Boutiques physiques, e-commerçants, vendeurs sur les réseaux sociaux, grossistes, entrepreneurs : Sama Stock s'adapte à votre façon de vendre."
            />
          </div>
          <div className="reveal mt-10">
            <SegmentsMarquee />
          </div>
          <div className="reveal mx-auto mt-10 max-w-6xl px-4 sm:px-6">
            <Segments />
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
              <LossCalculator installHref={INSTALL_HREF} />
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

        {/* ── Tarifs ── */}
        <section id="tarifs" className="scroll-mt-24 bg-[#f1f4f2] py-24 dark:bg-card/40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle
              kicker="Tarifs"
              title={
                <>
                  Payez une fois. <span className="whitespace-nowrap">Gardez-la</span> pour toujours.
                </>
              }
              text="Le prix comprend l'installation, votre logo, l'import de vos produits, la formation et un an d'assistance. Il peut se payer en deux fois."
            />
            <PricingTabs
              licence={
                <>
                  <div className="mt-10 grid gap-4 md:grid-cols-3">
                    {LICENSE_ORDER.map((id) => {
                      const p = LICENSE_PACKS[id];
                      const featured = id === "pro";
                      return (
                        <div
                          key={id}
                          className={cn(
                            "relative flex flex-col rounded-2xl border bg-card p-7",
                            featured && "border-primary shadow-[0_0_0_1px_var(--primary),0_24px_48px_-24px_rgb(11_110_79/0.45)]",
                          )}
                        >
                          {featured && (
                            <span className="absolute -top-3 left-7 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                              Recommandé
                            </span>
                          )}
                          <h3 className="text-[1.0625rem] font-semibold">Licence {p.label}</h3>
                          <p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.tagline}</p>
                          <p className="mt-6 flex items-baseline gap-1.5">
                            <span className="num text-[2.5rem] leading-none font-semibold tracking-[-0.04em]">{p.price.toLocaleString("fr-FR")}</span>
                            <span className="text-sm text-muted-foreground">FCFA</span>
                          </p>
                          <p className="mt-2.5 text-sm">
                            <span className="font-medium">Une seule fois.</span>{" "}
                            <span className="text-muted-foreground">Ensuite, maintenance facultative : {formatFCFA(p.maintenancePrice)} par an.</span>
                          </p>
                          <ul className="mt-7 space-y-3 text-sm">
                            {[
                              limitLabel(p.limits.maxProducts, "produits"),
                              p.limits.maxEmployees === 0 ? "Propriétaire seul" : limitLabel(p.limits.maxEmployees, "employés"),
                              `${p.limits.maxLocations} boutique${p.limits.maxLocations > 1 ? "s ou dépôts" : ""}`,
                              "Caisse, commandes, crédits, inventaire",
                              "Rapports avancés, import et export Excel",
                              "Installation, logo et couleurs compris",
                              "Import de vos produits et formation",
                              `${MAINTENANCE_INCLUDED_MONTHS} mois d'assistance compris`,
                            ].map((f) => (
                              <li key={f} className="flex gap-2.5">
                                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                                {f}
                              </li>
                            ))}
                          </ul>
                          <a
                            href={packHref(id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
                              featured ? "bg-primary text-primary-foreground hover:bg-[#095f44]" : "border bg-card hover:bg-muted",
                            )}
                          >
                            <MessageCircle className="size-4" /> Demander ce forfait
                          </a>
                          <DemoButton plan={id === "business" ? "business" : "pro"} variant="ghost" className="mt-2 w-full text-muted-foreground hover:text-foreground">
                            Voir la démo
                          </DemoButton>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-8 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                    <ShieldCheck className="size-4 text-primary" /> Acompte à la commande, solde à l&apos;installation · Wave, Orange Money ou
                    espèces · facture à votre nom
                  </p>
                </>
              }
              subscription={
                <>
                  <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">
                    Vous préférez commencer seul, depuis votre téléphone ? Créez votre compte en ligne : 14 jours gratuits, puis un
                    abonnement mensuel sans engagement.
                  </p>
                  <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {[PLANS.trial, ...PAID_PLANS].map((p) => (
                      <div key={p.id} className="relative flex flex-col rounded-2xl border bg-card p-7">
                        <h3 className="text-[1.0625rem] font-semibold">{p.label}</h3>
                        <p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.tagline}</p>
                        <p className="mt-6 flex items-baseline gap-1.5">
                          <span className="num text-[2.5rem] leading-none font-semibold tracking-[-0.04em]">{p.price.toLocaleString("fr-FR")}</span>
                          <span className="text-sm text-muted-foreground">{p.id === "trial" ? "FCFA · 14 jours" : "FCFA / mois"}</span>
                        </p>
                        <ul className="mt-7 space-y-3 text-sm">
                          {[
                            limitLabel(p.maxProducts, "produits"),
                            p.maxEmployees === 0 ? "Propriétaire seul" : limitLabel(p.maxEmployees, "employés"),
                            `${p.maxLocations} boutique${p.maxLocations > 1 ? "s ou dépôts" : ""}`,
                            "Caisse, commandes, crédits, inventaire",
                            p.advancedReports ? "Rapports avancés" : "Rapports avancés non inclus",
                            p.excel ? "Import et export Excel" : "Import et export Excel non inclus",
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
                          className="mt-8 inline-flex h-11 items-center justify-center rounded-lg border bg-card text-sm font-medium transition-colors hover:bg-muted"
                        >
                          {p.id === "trial" ? "Commencer l'essai gratuit" : `Essayer ${p.label} gratuitement`}
                        </Link>
                      </div>
                    ))}
                  </div>
                  <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="size-4 text-primary" /> Aucun prélèvement automatique : vous renouvelez quand vous le décidez.
                  </p>
                </>
              }
            />
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

        {/* ── Confiance ── */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6" aria-labelledby="confiance">
          <SectionTitle
            kicker="Confiance"
            title={<span id="confiance">Une entreprise sénégalaise, identifiable et responsable</span>}
            text="Vous confiez à Sama Stock le cœur de votre commerce. Voici qui nous sommes et comment nous protégeons vos données."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, title, text }) => (
              <li key={title} className="reveal surface p-6">
                <span className="grid size-10 place-items-center rounded-lg bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <p className="mt-4 font-semibold">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
          <p className="reveal mt-6 text-center text-sm text-muted-foreground">
            {LEGAL_PAGES.map((p, i) => (
              <span key={p.href}>
                {i > 0 && " · "}
                <Link href={p.href} className="underline-offset-4 hover:text-foreground hover:underline">
                  {p.label}
                </Link>
              </span>
            ))}
          </p>
        </section>

        {/* ── Appel final ── */}
        <section className="px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#0a3d2d] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_15%_0%,rgb(245_158_11/0.28),transparent_70%),radial-gradient(40%_50%_at_90%_100%,rgb(39_168_124/0.35),transparent_70%)]"
            />
            <div className="relative mx-auto max-w-3xl">
              <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
                Votre application, à&nbsp;votre&nbsp;nom.{" "}
                <span className="font-display font-normal tracking-normal text-saffron italic">Installée cette semaine.</span>
              </h2>
              <p className="mt-5 text-[1.0625rem] text-white/75">
                Écrivez-nous sur WhatsApp : on vous fait la démonstration, on fixe le prix ensemble et on l&apos;installe chez vous.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={INSTALL_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-saffron px-6 font-semibold text-saffron-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
                >
                  <MessageCircle className="size-[1.125rem]" /> Demander une installation
                </a>
                <DemoButton
                  plan="pro"
                  variant="outline"
                  className="h-12 border-white/25 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
                >
                  <PlayCircle className="size-4" /> Voir la démo
                </DemoButton>
              </div>
              <p className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-white/60">
                <a href={`tel:+${LEGAL.whatsapp}`} className="inline-flex items-center gap-2 hover:text-white">
                  <Phone className="size-4" /> {LEGAL.phone}
                </a>
                <span className="inline-flex items-center gap-2">
                  <Smartphone className="size-4" /> Téléphone, tablette et ordinateur
                </span>
              </p>
              {session ? (
                <Link href="/tableau-de-bord" className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/80 underline-offset-4 hover:underline">
                  Ouvrir mon espace <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link href="/inscription" className="mt-4 inline-block text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">
                  Ou commencez seul : 14 jours d&apos;essai gratuit en ligne
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-sm text-muted-foreground">
              L&apos;application de gestion de stock, de caisse et de crédits, installée chez vous à votre nom. Pour les commerçants du
              Sénégal.
            </p>
            <a
              href={INSTALL_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <MessageCircle className="size-4" /> WhatsApp : {LEGAL.phone}
            </a>
          </div>
          <div className="space-y-2.5">
            <p className="font-medium">Produit</p>
            <a href="#comment" className="block text-muted-foreground hover:text-foreground">
              Comment ça marche
            </a>
            <a href="#fonctionnalites" className="block text-muted-foreground hover:text-foreground">
              Fonctionnalités
            </a>
            <a href="#tarifs" className="block text-muted-foreground hover:text-foreground">
              Tarifs
            </a>
            <a href="#presentation" className="block text-muted-foreground hover:text-foreground">
              Vidéo de présentation
            </a>
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
          <div className="space-y-2.5">
            <p className="font-medium">Légal</p>
            {LEGAL_PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="block text-muted-foreground hover:text-foreground">
                {p.label}
              </Link>
            ))}
            <a href={`mailto:${LEGAL.email}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <Mail className="size-3.5" /> {LEGAL.email}
            </a>
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

      {!session && <StickyCta href={INSTALL_HREF} label="Demander une installation" />}
      <ScrollReveal />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}

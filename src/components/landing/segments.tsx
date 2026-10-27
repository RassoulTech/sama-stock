"use client";

import { Check, Hammer, Rocket, Shirt, ShoppingBag, Store, Warehouse, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Segment {
  id: string;
  label: string;
  short: string;
  icon: LucideIcon;
  title: string;
  text: string;
  points: string[];
  tags: string[];
}

const SEGMENTS: Segment[] = [
  {
    id: "boutiques",
    label: "Boutiques & supérettes",
    short: "Boutiques",
    icon: Store,
    title: "Une caisse rapide et un stock toujours juste",
    text: "Chaque vente fait baisser le stock tout seul. Vous savez ce qui reste, ce qui part et ce qu'il faut racheter, sans cahier.",
    points: [
      "Encaissement en quelques touches : espèces, Wave, Orange Money",
      "Alerte avant la rupture de chaque produit",
      "Ventes à crédit et rappels par WhatsApp",
    ],
    tags: ["Riz 25 kg", "Huile 5 L", "Sucre", "Lait en poudre", "Savon"],
  },
  {
    id: "en-ligne",
    label: "E-commerce & vente en ligne",
    short: "Vente en ligne",
    icon: ShoppingBag,
    title: "Toutes vos commandes en ligne au même endroit",
    text: "WhatsApp, Instagram, TikTok, Facebook ou votre site : chaque commande est suivie jusqu'à la livraison, et le stock est réservé dès qu'elle est enregistrée.",
    points: [
      "Suivi Nouvelle → En préparation → En livraison → Livrée",
      "Stock réservé automatiquement : plus de vente en double",
      "Récapitulatif de commande envoyé au client sur WhatsApp",
    ],
    tags: ["WhatsApp", "Instagram", "TikTok", "Facebook", "Site web"],
  },
  {
    id: "mode",
    label: "Mode & beauté",
    short: "Mode & beauté",
    icon: Shirt,
    title: "Vos articles, vos meilleures ventes, vos vraies marges",
    text: "Robes, chaussures, mèches, cosmétiques : suivez chaque article et voyez en un coup d'œil ce qui rapporte vraiment.",
    points: [
      "Bénéfice calculé sur le vrai coût d'achat",
      "Meilleures ventes et produits qui dorment",
      "Photos des produits directement à la caisse",
    ],
    tags: ["Robe wax", "Mèches", "Parfum", "Sac à main", "Sneakers"],
  },
  {
    id: "quincailleries",
    label: "Quincailleries & matériaux",
    short: "Quincailleries",
    icon: Hammer,
    title: "Au sac, au mètre, au kilo : tout se compte",
    text: "Vendez dans l'unité de votre choix, même en quantités décimales, et gardez la main sur un stock lourd et varié.",
    points: [
      "Unités adaptées : sac, mètre, kg, litre, carton…",
      "Entrées de stock et fournisseurs suivis",
      "Inventaires et pertes enregistrés",
    ],
    tags: ["Ciment 50 kg", "Fer de 10", "Câble 2,5 mm", "Peinture 20 L", "Tôle"],
  },
  {
    id: "grossistes",
    label: "Grossistes & dépôts",
    short: "Grossistes",
    icon: Warehouse,
    title: "Plusieurs boutiques et dépôts, un stock clair",
    text: "Suivez le stock de chaque lieu et transférez la marchandise d'un dépôt à une boutique en un instant.",
    points: [
      "Jusqu'à 5 boutiques ou dépôts avec la licence Business",
      "Transferts de stock entre lieux",
      "Une équipe avec des droits selon le rôle",
    ],
    tags: ["Dépôt central", "Boutique Médina", "Boutique Liberté 6", "Cartons", "Palettes"],
  },
  {
    id: "entrepreneurs",
    label: "Entrepreneurs",
    short: "Entrepreneurs",
    icon: Rocket,
    title: "Lancez-vous avec de bons chiffres dès le premier jour",
    text: "Vous démarrez une activité, en boutique ou en ligne ? Commencez gratuitement et pilotez votre commerce comme un pro, depuis votre téléphone.",
    points: [
      "14 jours gratuits, sans carte bancaire",
      "Sur téléphone, tablette et ordinateur",
      "Rapports clairs : ventes, bénéfice, crédits",
    ],
    tags: ["Premier stock", "Premières ventes", "Premier bénéfice", "Croissance"],
  },
];

const MARQUEE = [
  "Boutiques",
  "Supérettes",
  "E-commerçants",
  "Vendeurs Instagram",
  "Vendeurs TikTok",
  "Quincailleries",
  "Prêt-à-porter",
  "Cosmétiques",
  "Téléphonie & accessoires",
  "Grossistes",
  "Dépôts",
  "Librairies",
  "Pièces auto",
  "Entrepreneurs",
];

const AUTOPLAY_MS = 5000;

/** Bande défilante des métiers (de gauche à droite), en boucle. */
export function SegmentsMarquee() {
  const items = [...MARQUEE, ...MARQUEE];
  return (
    <div className="marquee relative overflow-hidden py-1 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div className="marquee-track flex w-max gap-3" aria-hidden>
        {items.map((m, i) => (
          <span
            key={`${m}-${i}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground"
          >
            <span className="size-1.5 rounded-full bg-saffron" />
            {m}
          </span>
        ))}
      </div>
      <p className="sr-only">Pour : {MARQUEE.join(", ")}.</p>
    </div>
  );
}

/** Onglets par domaine : repère qui glisse, contenu qui arrive de gauche à droite, défilement automatique. */
export function Segments() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  // Le repère suit l'onglet actif ; la rangée défile pour le garder visible sur mobile
  useEffect(() => {
    const place = () => {
      const list = listRef.current;
      const tab = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
      const pill = pillRef.current;
      if (!list || !tab || !pill) return;
      pill.style.width = `${tab.offsetWidth}px`;
      pill.style.translate = `${tab.offsetLeft}px 0`;
      list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active]);

  // Défilement automatique, seulement quand la section est à l'écran
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.35 });
    if (rootRef.current) observer.observe(rootRef.current);
    const timer = window.setInterval(() => {
      if (visible && document.visibilityState === "visible") setActive((i) => (i + 1) % SEGMENTS.length);
    }, AUTOPLAY_MS);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [auto]);

  const segment = SEGMENTS[active];
  const Icon = segment.icon;

  return (
    <div ref={rootRef} onMouseEnter={() => setAuto(false)} onFocusCapture={() => setAuto(false)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Domaines d'activité"
        className="scroll-row relative mx-auto flex max-w-full gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5 sm:w-fit"
      >
        <span
          ref={pillRef}
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-0 rounded-xl bg-primary shadow-[0_8px_20px_-8px_rgb(11_110_79/0.6)] transition-[translate,width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        />
        {SEGMENTS.map((s, i) => {
          const TabIcon = s.icon;
          const selected = i === active;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`tab-${s.id}`}
              data-index={i}
              aria-selected={selected}
              aria-controls={`panel-${s.id}`}
              onClick={() => {
                setAuto(false);
                setActive(i);
              }}
              className={cn(
                "relative z-10 inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-medium whitespace-nowrap transition-colors duration-300",
                selected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TabIcon className="size-4" />
              {s.short}
            </button>
          );
        })}
      </div>

      <div
        key={segment.id}
        role="tabpanel"
        id={`panel-${segment.id}`}
        aria-labelledby={`tab-${segment.id}`}
        className="mt-10 grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]"
      >
        <div>
          <h3 className="slide-in text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-[2rem]">
            {segment.title}
          </h3>
          <p className="slide-in mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground [--slide-delay:80ms]">
            {segment.text}
          </p>
          <ul className="mt-6 space-y-3">
            {segment.points.map((p, i) => (
              <li
                key={p}
                className="slide-in flex gap-3 text-[0.9375rem]"
                style={{ "--slide-delay": `${160 + i * 80}ms` } as React.CSSProperties}
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-primary">
                  <Check className="size-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="slide-in relative overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,#0b6e4f,#0a3d2d)] p-7 text-white [--slide-delay:120ms] sm:p-9">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-saffron/25 blur-3xl" />
          <span className="relative grid size-14 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20">
            <Icon className="size-7" />
          </span>
          <p className="relative mt-5 text-sm font-medium text-white/70">{segment.label}</p>
          <div className="relative mt-4 flex flex-wrap gap-2">
            {segment.tags.map((t, i) => (
              <span
                key={t}
                className="slide-in rounded-full bg-white/12 px-3.5 py-1.5 text-sm font-medium ring-1 ring-white/15"
                style={{ "--slide-delay": `${220 + i * 70}ms` } as React.CSSProperties}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="relative mt-7 h-1 overflow-hidden rounded-full bg-white/15">
            <span
              key={`${segment.id}-${auto}`}
              className={cn("block h-full w-full origin-left rounded-full bg-saffron", auto && "segment-progress")}
              style={{ "--segment-ms": `${AUTOPLAY_MS}ms` } as React.CSSProperties}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

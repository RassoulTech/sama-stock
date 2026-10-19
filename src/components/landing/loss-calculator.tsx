"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatFCFA, formatNumber } from "@/lib/format";

const PRO_PRICE = 5000;

function Slider({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <output htmlFor={id} className="num text-sm font-semibold text-primary">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[#0b6e4f]"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Estimation transparente, à partir des chiffres que le commerçant saisit lui-même. */
export function LossCalculator() {
  const [daily, setDaily] = useState(60000);
  const [missedPct, setMissedPct] = useState(5);
  const [credits, setCredits] = useState(25000);
  const [shrink, setShrink] = useState(15000);

  const missed = Math.round((daily * 30 * missedPct) / 100);
  const total = missed + credits + shrink;
  const ratio = Math.max(1, Math.floor(total / PRO_PRICE));

  return (
    <div className="grid overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(11_19_16/0.04),0_24px_48px_-24px_rgb(11_19_16/0.18)] lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-7 p-6 sm:p-8">
        <Slider
          id="calc-daily"
          label="Vos ventes par jour"
          hint="Chiffre d'affaires moyen d'une journée."
          value={daily}
          onChange={setDaily}
          min={10000}
          max={500000}
          step={5000}
          format={formatFCFA}
        />
        <Slider
          id="calc-missed"
          label="Ventes ratées à cause d'une rupture"
          hint="Le client demande, le produit manque, il va ailleurs."
          value={missedPct}
          onChange={setMissedPct}
          min={0}
          max={20}
          step={1}
          format={(v) => `${v} %`}
        />
        <Slider
          id="calc-credits"
          label="Crédits clients jamais récupérés, par mois"
          hint="Ce qu'on oublie de réclamer faute de suivi."
          value={credits}
          onChange={setCredits}
          min={0}
          max={300000}
          step={5000}
          format={formatFCFA}
        />
        <Slider
          id="calc-shrink"
          label="Casse, vols et pertes, par mois"
          hint="La marchandise qui disparaît sans être vendue."
          value={shrink}
          onChange={setShrink}
          min={0}
          max={300000}
          step={5000}
          format={formatFCFA}
        />
      </div>
      <div className="relative flex flex-col justify-between gap-8 overflow-hidden bg-[#0a3d2d] p-6 text-white sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-saffron/20 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-medium tracking-[0.14em] text-white/60 uppercase">Votre estimation</p>
          <p className="mt-3 text-sm text-white/75">Chaque mois, votre commerce perd environ</p>
          <p className="num mt-1 text-[2.75rem] leading-none font-semibold tracking-[-0.04em] sm:text-[3.25rem]">
            {formatNumber(total)}
            <span className="ml-2 text-lg font-medium tracking-normal text-white/60">FCFA</span>
          </p>
          <dl className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm">
            {[
              ["Ventes ratées (ruptures)", missed],
              ["Crédits non récupérés", credits],
              ["Casse, vols, pertes", shrink],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-4">
                <dt className="text-white/65">{label}</dt>
                <dd className="num font-medium">{formatFCFA(value as number)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative space-y-4">
          <p className="text-[0.9375rem] leading-relaxed text-white/85">
            La formule Pro coûte <strong className="text-white">{formatFCFA(PRO_PRICE)} par mois</strong>, soit{" "}
            <strong className="text-saffron">{ratio} fois moins</strong> que ce que vous perdez.
          </p>
          <Link
            href="/inscription"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-saffron px-5 text-[0.9375rem] font-semibold text-saffron-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] transition-colors hover:bg-[#ec9708]"
          >
            Arrêter ces pertes, essai gratuit <ArrowRight className="size-4" />
          </Link>
          <p className="text-center text-xs text-white/50">Estimation à partir de vos propres chiffres.</p>
        </div>
      </div>
    </div>
  );
}

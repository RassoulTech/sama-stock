import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

const TONES = {
  green: { bar: "bg-primary", tile: "bg-accent text-primary" },
  blue: { bar: "bg-sky-500", tile: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  saffron: { bar: "bg-saffron", tile: "bg-saffron/15 text-warning dark:text-saffron" },
  red: { bar: "bg-destructive", tile: "bg-destructive/10 text-destructive" },
  slate: { bar: "bg-muted-foreground/40", tile: "bg-muted text-muted-foreground" },
} as const;

/**
 * Carte de chiffre clé de l'administration : couleur selon la nature de l'information,
 * tendance facultative (« +3 ce mois »), entrée en douceur, chiffre qui défile.
 * Compacte sur téléphone (deux cartes par ligne).
 */
export function AdminStat({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = "green",
  href,
  index = 0,
  trend,
}: {
  label: string;
  value: number;
  unit?: string;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
  index?: number;
  /** Évolution : `good` dit si la hausse est une bonne nouvelle (vert) ou non (orange). */
  trend?: { text: string; up: boolean; good?: boolean } | null;
}) {
  const colors = TONES[tone];
  const trendGood = trend ? (trend.good ?? trend.up) : false;
  const body = (
    <>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", colors.bar)} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8125rem] leading-snug font-medium text-muted-foreground sm:text-sm">{label}</p>
        <span
          className={cn(
            "hidden size-9 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110 sm:grid",
            colors.tile,
          )}
        >
          <Icon className="size-[1.125rem]" />
        </span>
      </div>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 sm:mt-2">
        <span className="num text-[1.375rem] leading-tight font-semibold tracking-[-0.03em] sm:text-[1.75rem]">
          <CountUp value={value} />
        </span>
        {unit && <span className="text-xs font-medium text-muted-foreground sm:text-sm">{unit}</span>}
      </p>
      {trend && (
        <p
          className={cn(
            "mt-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
            trendGood ? "bg-success/10 text-success" : "bg-saffron/15 text-warning dark:text-saffron",
          )}
        >
          {trend.up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {trend.text}
        </p>
      )}
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground sm:mt-2 sm:text-xs">{hint}</p>}
    </>
  );

  const className = cn(
    "enter group relative block overflow-hidden rounded-xl border bg-card p-3.5 pl-4.5 shadow-[0_1px_2px_rgb(11_19_16/0.04)] transition-[box-shadow,border-color] duration-300 sm:p-5 sm:pl-6",
    href && "hover:border-primary/30 hover:shadow-[0_16px_32px_-18px_rgb(11_19_16/0.3)] focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
  );
  const style = { "--enter-delay": `${index * 60}ms` } as React.CSSProperties;

  return href ? (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  );
}

/** Tendance d'un compteur par rapport à la période précédente (null si rien à comparer). */
export function compareTrend(current: number, previous: number, suffix: string, opts: { goodWhenUp?: boolean; format?: (n: number) => string } = {}) {
  if (current === previous) return null;
  const diff = current - previous;
  const fmt = opts.format ?? ((n: number) => String(n));
  return { text: `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))} ${suffix}`, up: diff > 0, good: (opts.goodWhenUp ?? true) ? diff > 0 : diff < 0 };
}

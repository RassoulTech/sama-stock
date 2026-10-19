import type { LucideIcon } from "lucide-react";
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
 * entrée en douceur (décalée par `index`), chiffre qui défile, léger relief au survol.
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
}: {
  label: string;
  value: number;
  unit?: string;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
  index?: number;
}) {
  const colors = TONES[tone];
  const body = (
    <>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", colors.bar)} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110",
            colors.tile,
          )}
        >
          <Icon className="size-[1.125rem]" />
        </span>
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="num text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">
          <CountUp value={value} />
        </span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  const className = cn(
    "enter group relative block overflow-hidden rounded-xl border bg-card p-5 pl-6 shadow-[0_1px_2px_rgb(11_19_16/0.04)] transition-[box-shadow,border-color] duration-300",
    href && "hover:border-primary/30 hover:shadow-[0_16px_32px_-18px_rgb(11_19_16/0.3)] focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
  );
  const style = { "--enter-delay": `${index * 70}ms` } as React.CSSProperties;

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

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "bg-accent text-primary",
  saffron: "bg-saffron/15 text-warning dark:text-saffron",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.8125rem] leading-snug font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONES[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="num mt-3 flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5 text-[1.25rem] leading-none font-semibold tracking-[-0.03em] min-[400px]:text-[1.375rem] sm:text-[1.5rem] xl:text-[1.625rem]">
        {typeof value === "string" && value.endsWith(" FCFA") ? (
          <>
            <span className="whitespace-nowrap">{value.slice(0, -5)}</span>
            <span className="text-xs font-medium tracking-normal text-muted-foreground sm:text-[0.8125rem]">FCFA</span>
          </>
        ) : (
          value
        )}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const classes = cn("surface block p-4 sm:p-5", href && "transition-colors hover:border-primary/40", className);
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

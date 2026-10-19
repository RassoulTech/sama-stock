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
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONES[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="num mt-2 text-xl leading-tight font-extrabold tracking-tight sm:text-2xl xl:text-[1.65rem]">
        {typeof value === "string" && value.endsWith(" FCFA") ? (
          <>
            {value.slice(0, -5)}
            <span className="ml-1 text-xs font-bold text-muted-foreground sm:text-sm">FCFA</span>
          </>
        ) : (
          value
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const classes = cn(
    "block rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgba(14,26,22,0.04),0_4px_16px_-8px_rgba(14,26,22,0.08)] ring-1 ring-foreground/[0.07]",
    href && "transition-colors hover:ring-primary/30",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

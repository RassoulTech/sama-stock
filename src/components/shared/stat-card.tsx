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
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONES[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="num mt-3 text-[1.375rem] leading-none font-semibold tracking-[-0.03em] sm:text-[1.625rem]">
        {typeof value === "string" && value.endsWith(" FCFA") ? (
          <>
            {value.slice(0, -5)}
            <span className="ml-1 text-xs font-medium tracking-normal text-muted-foreground sm:text-[0.8125rem]">FCFA</span>
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

import { STOCK_STATUS_LABELS, type StockStatus } from "@/lib/domain/stock";
import { cn } from "@/lib/utils";

const TONES = {
  green: "bg-success/8 text-success ring-success/20",
  saffron: "bg-saffron/12 text-warning ring-saffron/30 dark:text-saffron",
  red: "bg-destructive/8 text-destructive ring-destructive/20",
  blue: "bg-sky-500/8 text-sky-700 ring-sky-600/20 dark:text-sky-300",
  gray: "bg-muted text-muted-foreground ring-border",
} as const;

const DOTS = {
  green: "bg-success",
  saffron: "bg-saffron",
  red: "bg-destructive",
  blue: "bg-sky-500",
  gray: "bg-muted-foreground",
} as const;

const STOCK_TONES: Record<StockStatus, keyof typeof TONES> = { ok: "green", low: "saffron", out: "red" };

const base =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset";

export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  const tone = STOCK_TONES[status];
  return (
    <span className={cn(base, TONES[tone], className)}>
      <span className={cn("size-1.5 rounded-full", DOTS[tone])} />
      {STOCK_STATUS_LABELS[status]}
    </span>
  );
}

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn(base, TONES[tone], className)}>{children}</span>;
}

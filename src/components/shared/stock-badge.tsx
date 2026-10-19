import { STOCK_STATUS_LABELS, type StockStatus } from "@/lib/domain/stock";
import { cn } from "@/lib/utils";

const STYLES: Record<StockStatus, string> = {
  ok: "bg-success/10 text-success",
  low: "bg-saffron/15 text-warning dark:text-saffron",
  out: "bg-destructive/10 text-destructive",
};

const DOTS: Record<StockStatus, string> = {
  ok: "bg-success",
  low: "bg-saffron",
  out: "bg-destructive",
};

export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        STYLES[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOTS[status])} />
      {STOCK_STATUS_LABELS[status]}
    </span>
  );
}

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: "green" | "saffron" | "red" | "blue" | "gray";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    green: "bg-success/10 text-success",
    saffron: "bg-saffron/15 text-warning dark:text-saffron",
    red: "bg-destructive/10 text-destructive",
    blue: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    gray: "bg-muted text-muted-foreground",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

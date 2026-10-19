"use client";

import { cn } from "@/lib/utils";

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground",
            value === o.value && "border-primary/30 bg-accent text-accent-foreground hover:text-accent-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span
              className={cn(
                "num rounded-full bg-muted px-1.5 text-xs",
                value === o.value && "bg-primary/10 text-accent-foreground",
              )}
            >
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

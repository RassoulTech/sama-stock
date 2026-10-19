"use client";

import { Minus, Plus } from "lucide-react";
import { unitAllowsDecimals } from "@/lib/format";
import { roundQty } from "@/lib/domain/stock";
import { cn } from "@/lib/utils";

/** Champ quantité avec boutons − / + (grands boutons pour le tactile). */
export function QtyStepper({
  value,
  onChange,
  unit,
  min = 0,
  max,
  className,
  label = "Quantité",
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  unit: string;
  min?: number;
  max?: number;
  className?: string;
  label?: string;
}) {
  const decimals = unitAllowsDecimals(unit);
  const current = value === "" ? 0 : value;
  const clamp = (n: number) => {
    let v = roundQty(n);
    if (v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  };

  return (
    <div className={cn("flex h-11 items-center rounded-xl border border-input bg-card", className)}>
      <button
        type="button"
        onClick={() => onChange(clamp(current - 1))}
        className="grid h-full w-11 shrink-0 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
        disabled={current <= min}
        aria-label="Diminuer"
      >
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode={decimals ? "decimal" : "numeric"}
        step={decimals ? "0.001" : "1"}
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        onBlur={() => value !== "" && onChange(clamp(value))}
        className="num h-full w-full min-w-0 bg-transparent text-center text-base font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(current + 1))}
        className="grid h-full w-11 shrink-0 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
        disabled={max !== undefined && current >= max}
        aria-label="Augmenter"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

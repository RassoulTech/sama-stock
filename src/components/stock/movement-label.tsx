import { formatQty } from "@/lib/format";
import { MOVEMENT_TYPES, REASON_LABELS, type MovementType } from "@/lib/domain/stock";
import { cn } from "@/lib/utils";

export function movementTypeLabel(type: string) {
  return MOVEMENT_TYPES[type as MovementType] ?? type;
}

export function reasonLabel(reason: string | null) {
  return reason ? (REASON_LABELS[reason] ?? reason) : null;
}

export function SignedQty({ quantity, unit, className }: { quantity: number; unit?: string; className?: string }) {
  const positive = quantity > 0;
  return (
    <span
      className={cn("num font-semibold whitespace-nowrap", positive ? "text-success" : "text-destructive", className)}
    >
      {positive ? "+" : "−"}
      {formatQty(Math.abs(quantity), unit)}
    </span>
  );
}

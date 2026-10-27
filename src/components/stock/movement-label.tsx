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
  // Écart nul d'un inventaire : le produit a été compté et tout était là
  if (quantity === 0) return <span className={cn("font-semibold whitespace-nowrap text-muted-foreground", className)}>Conforme</span>;
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

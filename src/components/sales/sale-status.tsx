import { StatusPill } from "@/components/shared/stock-badge";
import { isOrderStatus, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain/orders";

const ORDER_TONES: Record<OrderStatus, "green" | "saffron" | "red" | "blue" | "gray"> = {
  new: "saffron",
  preparing: "blue",
  shipping: "blue",
  delivered: "green",
  cancelled: "gray",
  returned: "red",
};

export function SaleStatus({ kind, status }: { kind: string; status: string }) {
  if (kind === "order" && isOrderStatus(status)) {
    return <StatusPill tone={ORDER_TONES[status]}>{ORDER_STATUS_LABELS[status]}</StatusPill>;
  }
  return status === "cancelled" ? <StatusPill tone="gray">Annulée</StatusPill> : <StatusPill tone="green">Validée</StatusPill>;
}

export function PaymentStatus({ total, amountPaid }: { total: number; amountPaid: number }) {
  if (amountPaid >= total) return <StatusPill tone="green">Payé</StatusPill>;
  if (amountPaid > 0) return <StatusPill tone="saffron">Partiel</StatusPill>;
  return <StatusPill tone="red">Non payé</StatusPill>;
}

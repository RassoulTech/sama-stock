"use client";

import { Banknote, CreditCard, HandCoins, Smartphone } from "lucide-react";
import { isBrandedMethod, PaymentLogo } from "@/components/shared/payment-logo";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";

const STYLES: Record<PaymentMethod, { icon: typeof Banknote; dot: string }> = {
  cash: { icon: Banknote, dot: "bg-emerald-500" },
  wave: { icon: Smartphone, dot: "bg-sky-500" },
  orange_money: { icon: Smartphone, dot: "bg-orange-500" },
  free_money: { icon: Smartphone, dot: "bg-red-500" },
  card: { icon: CreditCard, dot: "bg-slate-500" },
  credit: { icon: HandCoins, dot: "bg-amber-500" },
};

export function PaymentMethodPicker<M extends PaymentMethod>({
  value,
  onChange,
  methods,
}: {
  value: M;
  onChange: (method: M) => void;
  methods: readonly M[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Mode de paiement">
      {methods.map((m) => {
        const { icon: Icon, dot } = STYLES[m];
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={cn(
              "relative flex h-12 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-semibold transition-colors hover:border-primary/40",
              active && "border-primary bg-accent text-accent-foreground ring-2 ring-primary/20",
            )}
          >
            {isBrandedMethod(m) ? <PaymentLogo method={m} /> : <Icon className="size-4 shrink-0" />}
            <span className="truncate">{PAYMENT_METHODS[m]}</span>
            <span className={cn("absolute top-2 right-2 size-1.5 rounded-full", dot)} />
          </button>
        );
      })}
    </div>
  );
}

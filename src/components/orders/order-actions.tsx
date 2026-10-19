"use client";

import { HandCoins, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { FormError, FormField, SuffixInput } from "@/components/shared/form-field";
import { PaymentMethodPicker } from "@/components/shared/payment-method-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatFCFA } from "@/lib/format";
import { ORDER_ACTION_LABELS, type OrderStatus } from "@/lib/domain/orders";
import { PAYING_METHODS } from "@/lib/domain/sales";
import { recordOrderPayment, updateOrderStatus } from "@/server/actions/orders";

const CONFIRM_TEXT: Partial<Record<OrderStatus, string>> = {
  shipping: "Les produits vont sortir du stock.",
  cancelled: "La réservation des produits sera libérée. Cette action est définitive.",
  returned: "Les produits reviendront en stock. Cette action est définitive.",
  delivered: "La commande comptera dans votre chiffre d'affaires.",
};

export function OrderStatusButtons({ id, next }: { id: string; next: readonly OrderStatus[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      {next.map((to) => {
        const destructive = to === "cancelled" || to === "returned";
        const confirmText = CONFIRM_TEXT[to];
        if (confirmText) {
          return (
            <ConfirmAction
              key={to}
              trigger={
                <Button variant={destructive ? "destructive" : to === "delivered" ? "default" : "saffron"} className="w-full">
                  {ORDER_ACTION_LABELS[to]}
                </Button>
              }
              title={`${ORDER_ACTION_LABELS[to]} ?`}
              description={confirmText}
              confirmLabel={ORDER_ACTION_LABELS[to]}
              destructive={destructive}
              successMessage="Statut mis à jour"
              action={() => updateOrderStatus(id, to)}
            />
          );
        }
        return (
          <Button
            key={to}
            className="w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await updateOrderStatus(id, to);
                if (!res.ok) toast.error(res.error);
                else toast.success("Statut mis à jour");
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {ORDER_ACTION_LABELS[to]}
          </Button>
        );
      })}
    </div>
  );
}

export function OrderPaymentDialog({ id, rest }: { id: string; rest: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | "">(rest);
  const [method, setMethod] = useState<(typeof PAYING_METHODS)[number]>("cash");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setAmount(rest);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <HandCoins /> Enregistrer un paiement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const res = await recordOrderPayment(id, { amount: Number(amount), method });
              if (!res.ok) return setError(res.error);
              toast.success("Paiement enregistré");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Paiement de la commande</DialogTitle>
            <DialogDescription>Reste à payer : {formatFCFA(rest)}</DialogDescription>
          </DialogHeader>
          <FormField label="Montant reçu" htmlFor="order-pay">
            <SuffixInput
              id="order-pay"
              suffix="FCFA"
              min={1}
              max={rest}
              step={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </FormField>
          <PaymentMethodPicker value={method} onChange={setMethod} methods={PAYING_METHODS} />
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending && <Loader2 className="animate-spin" />}
              Valider
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

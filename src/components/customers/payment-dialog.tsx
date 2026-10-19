"use client";

import { HandCoins, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { formatFCFA } from "@/lib/format";
import { PAYING_METHODS } from "@/lib/domain/sales";
import { recordCustomerPayment } from "@/server/actions/customers";

export function PaymentDialog({ customerId, customerName, debt }: { customerId: string; customerName: string; debt: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | "">(debt);
  const [method, setMethod] = useState<(typeof PAYING_METHODS)[number]>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await recordCustomerPayment({ customerId, amount: Number(amount), method, note });
      if (!res.ok) return setError(res.error);
      toast.success("Remboursement enregistré");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setAmount(debt);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <HandCoins /> Enregistrer un remboursement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Remboursement de {customerName}</DialogTitle>
            <DialogDescription>Dette actuelle : {formatFCFA(debt)}</DialogDescription>
          </DialogHeader>
          <FormField label="Montant reçu" htmlFor="pay-amount">
            <SuffixInput
              id="pay-amount"
              suffix="FCFA"
              min={1}
              max={debt}
              step={1}
              inputMode="numeric"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            {[debt, Math.round(debt / 2)]
              .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
              .map((v) => (
                <Button key={v} type="button" variant="outline" size="sm" onClick={() => setAmount(v)}>
                  {v === debt ? "Tout" : "La moitié"} · {formatFCFA(v)}
                </Button>
              ))}
          </div>
          <FormField label="Mode de paiement">
            <PaymentMethodPicker
              value={method}
              onChange={(m) => m !== "credit" && setMethod(m)}
              methods={PAYING_METHODS}
            />
          </FormField>
          <FormField label="Note (facultative)" htmlFor="pay-note">
            <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
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

"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { CustomerCombobox } from "@/components/customers/customer-combobox";
import type { CustomerOption } from "@/components/customers/customer-dialog";
import { FormError, FormField, SuffixInput } from "@/components/shared/form-field";
import { PaymentMethodPicker } from "@/components/shared/payment-method-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatFCFA } from "@/lib/format";
import { SALE_METHODS, type SaleMethod } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";

const ALL_METHODS: readonly SaleMethod[] = SALE_METHODS;

function quickAmounts(total: number) {
  const steps = [500, 1000, 2000, 5000, 10000];
  const values = new Set<number>([total]);
  for (const s of steps) {
    const v = Math.ceil(total / s) * s;
    if (v > total) values.add(v);
    if (values.size >= 4) break;
  }
  return [...values];
}

export interface CheckoutResult {
  paymentMethod: SaleMethod;
  amountReceived: number;
  customerId: string | null;
}

interface CheckoutProps {
  total: number;
  customers: CustomerOption[];
  onCustomerCreated: (c: CustomerOption) => void;
  onConfirm: (result: CheckoutResult) => void;
  pending: boolean;
  error: string | null;
  /** Sans internet, pas de création de client. */
  allowCustomerCreate?: boolean;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  ...props
}: CheckoutProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Encaisser</DialogTitle>
          <DialogDescription>Choisissez comment le client paie.</DialogDescription>
        </DialogHeader>
        {/* Le contenu est recréé à chaque ouverture : le montant reçu repart du total du panier */}
        <CheckoutForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function CheckoutForm({ total, customers, onCustomerCreated, onConfirm, pending, error, allowCustomerCreate = true }: CheckoutProps) {
  const [method, setMethod] = useState<SaleMethod>("cash");
  const [received, setReceived] = useState<number | "">(total);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const amount = method === "credit" ? 0 : received === "" ? 0 : received;
  const paid = Math.min(amount, total);
  const rest = total - paid;
  const change = method === "cash" ? Math.max(0, amount - total) : 0;
  const needsCustomer = rest > 0;

  function changeMethod(m: SaleMethod) {
    setMethod(m);
    setLocalError(null);
    if (m !== "credit" && received === "") setReceived(total);
  }

  function confirm() {
    if (needsCustomer && !customerId) {
      setLocalError("Choisissez le client qui doit le reste.");
      return;
    }
    setLocalError(null);
    onConfirm({ paymentMethod: method, amountReceived: amount, customerId });
  }

  return (
    <>
      <div className="rounded-xl bg-primary px-5 py-4 text-primary-foreground">
        <p className="text-sm opacity-80">Total à payer</p>
        <p className="num text-3xl font-semibold tracking-tight">{formatFCFA(total)}</p>
      </div>

      <div className="space-y-5">
        <FormField label="Mode de paiement">
          <PaymentMethodPicker value={method} onChange={changeMethod} methods={ALL_METHODS} />
        </FormField>

        {method !== "credit" && (
          <FormField label="Montant reçu" htmlFor="received">
            <SuffixInput
              id="received"
              suffix="FCFA"
              min={0}
              step={1}
              inputMode="numeric"
              value={received}
              onChange={(e) => setReceived(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {quickAmounts(total).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={received === v ? "default" : "outline"}
                  onClick={() => setReceived(v)}
                  className="num"
                >
                  {formatFCFA(v)}
                </Button>
              ))}
            </div>
          </FormField>
        )}

        {(change > 0 || rest > 0) && (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl px-4 py-3",
              change > 0 ? "bg-success/10 text-success" : "bg-saffron/15 text-warning dark:text-saffron",
            )}
          >
            <span className="text-sm font-medium">{change > 0 ? "Monnaie à rendre" : "Reste à payer (crédit)"}</span>
            <span className="num text-lg font-semibold">{formatFCFA(change > 0 ? change : rest)}</span>
          </div>
        )}

        <FormField label={needsCustomer ? "Client (obligatoire pour un crédit)" : "Client (facultatif)"}>
          <CustomerCombobox
            customers={customers}
            value={customerId}
            onChange={(id) => {
              setCustomerId(id);
              setLocalError(null);
            }}
            onCreated={onCustomerCreated}
            invalid={Boolean(localError)}
            allowCreate={allowCustomerCreate}
          />
          {!allowCustomerCreate && <p className="text-xs text-muted-foreground">Sans internet, choisissez un client déjà enregistré.</p>}
        </FormField>

        <FormError message={localError ?? error} />
        <Button type="button" size="lg" variant="saffron" className="w-full" disabled={pending} onClick={confirm}>
          {pending && <Loader2 className="animate-spin" />}
          Valider la vente
        </Button>
      </div>
    </>
  );
}

"use client";

import { Check, FileText, Loader2, ReceiptText, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError, FormField, SuffixInput } from "@/components/shared/form-field";
import { PaymentMethodPicker } from "@/components/shared/payment-method-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatFCFA, formatPhone } from "@/lib/format";
import { SALE_METHODS, type SaleMethod } from "@/lib/domain/sales";
import { convertQuoteToSale, createInvoiceFromSale, setQuoteStatus } from "@/server/actions/documents";

/** Fiche client de la facture : préremplie depuis la vente, modifiable (NINEA d'une entreprise cliente…). */
export function CreateInvoiceDialog({
  saleId,
  customer,
  label = "Créer la facture",
}: {
  saleId: string;
  customer: { name: string; phone: string | null; address: string | null } | null;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          <FileText /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer la facture</DialogTitle>
          <DialogDescription>
            Elle reprend les produits et les montants de la vente. Une fois créée, elle ne change plus.
          </DialogDescription>
        </DialogHeader>
        <form
          id="invoice-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              const res = await createInvoiceFromSale(saleId, {
                customer: {
                  name: String(form.get("name") ?? ""),
                  phone: String(form.get("phone") ?? ""),
                  address: String(form.get("address") ?? ""),
                  ninea: String(form.get("ninea") ?? ""),
                },
              });
              if (!res.ok) return setError(res.error);
              toast.success("Facture créée");
              setOpen(false);
              router.push(`/factures/${res.data.id}`);
            });
          }}
        >
          <FormField label="Nom du client ou de l'entreprise" htmlFor="inv-name">
            <Input id="inv-name" name="name" required minLength={2} defaultValue={customer?.name ?? ""} autoComplete="off" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Téléphone" htmlFor="inv-phone">
              <Input id="inv-phone" name="phone" type="tel" defaultValue={customer?.phone ? formatPhone(customer.phone) : ""} />
            </FormField>
            <FormField label="NINEA du client" htmlFor="inv-ninea" hint="Seulement pour une entreprise.">
              <Input id="inv-ninea" name="ninea" autoCapitalize="characters" />
            </FormField>
          </div>
          <FormField label="Adresse" htmlFor="inv-address">
            <Input id="inv-address" name="address" defaultValue={customer?.address ?? ""} placeholder="Rue, quartier, ville…" />
          </FormField>
          <FormError message={error} />
        </form>
        <DialogFooter>
          <Button type="submit" form="invoice-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Créer la facture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuoteStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(to: "en_cours" | "accepte" | "refuse", message: string) {
    startTransition(async () => {
      const res = await setQuoteStatus(id, to);
      if (!res.ok) return void toast.error(res.error);
      toast.success(message);
      router.refresh();
    });
  }

  if (status === "en_cours") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => set("accepte", "Devis marqué accepté")}>
          <Check /> Accepté
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => set("refuse", "Devis marqué refusé")}>
          <X /> Refusé
        </Button>
      </div>
    );
  }
  return (
    <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={() => set("en_cours", "Devis remis en cours")}>
      <RotateCcw /> Remettre « en cours »
    </Button>
  );
}

/** Transformer un devis en vente : le client paie maintenant (tout ou partie) ou à crédit. */
export function ConvertQuoteDialog({ id, total, hasCustomer }: { id: string; total: number; hasCustomer: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<SaleMethod>("cash");
  const [received, setReceived] = useState<number | "">(total);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const paid = method === "credit" ? 0 : Math.min(Number(received) || 0, total);

  function confirm() {
    setError(null);
    if (paid < total && !hasCustomer) {
      return setError("Pour un paiement partiel ou à crédit, le devis doit être fait pour un client enregistré. Modifiez le devis et choisissez le client.");
    }
    startTransition(async () => {
      const res = await convertQuoteToSale(id, { paymentMethod: method, amountReceived: method === "credit" ? 0 : Number(received) || 0 });
      if (!res.ok) return setError(res.error);
      toast.success("Vente enregistrée, stock mis à jour");
      setOpen(false);
      router.push(`/ventes/${res.data.saleId}?nouvelle=1`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setMethod("cash");
          setReceived(total);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="lg" variant="saffron" className="w-full">
          <ReceiptText /> Transformer en vente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transformer en vente</DialogTitle>
          <DialogDescription>La vente reprend les produits et les prix du devis. Le stock baisse tout de suite.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-primary px-5 py-4 text-primary-foreground">
          <p className="text-sm opacity-80">Total du devis</p>
          <p className="num text-3xl font-semibold tracking-tight">{formatFCFA(total)}</p>
        </div>
        <FormField label="Mode de paiement">
          <PaymentMethodPicker value={method} onChange={setMethod} methods={SALE_METHODS} />
        </FormField>
        {method !== "credit" && (
          <FormField label="Montant reçu maintenant" htmlFor="q-received">
            <SuffixInput
              id="q-received"
              suffix="FCFA"
              min={0}
              step={1}
              inputMode="numeric"
              value={received}
              onChange={(e) => setReceived(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </FormField>
        )}
        {paid < total && <p className="text-sm text-muted-foreground">Reste à payer : {formatFCFA(total - paid)} (crédit du client).</p>}
        <FormError message={error} />
        <DialogFooter>
          <Button type="button" onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Enregistrer la vente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

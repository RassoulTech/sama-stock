"use client";

import { Loader2, ShoppingBag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CustomerCombobox } from "@/components/customers/customer-combobox";
import type { CustomerOption } from "@/components/customers/customer-dialog";
import { ProductThumb } from "@/components/products/product-thumb";
import { FormError, FormField, SuffixInput } from "@/components/shared/form-field";
import { PaymentMethodPicker } from "@/components/shared/payment-method-picker";
import { ProductPicker, type PickerProduct } from "@/components/shared/product-picker";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA, formatQty } from "@/lib/format";
import { CHANNELS, ORDER_CHANNELS, PAYING_METHODS } from "@/lib/domain/sales";
import { cn } from "@/lib/utils";
import { createOrder } from "@/server/actions/orders";

type Channel = (typeof ORDER_CHANNELS)[number];
type PayingMethod = (typeof PAYING_METHODS)[number];

export function OrderForm({ products, customers: initialCustomers }: { products: PickerProduct[]; customers: CustomerOption[] }) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [lines, setLines] = useState<{ product: PickerProduct; quantity: number | "" }[]>([]);
  const [deliveryFee, setDeliveryFee] = useState<number | "">("");
  const [address, setAddress] = useState("");
  const [paid, setPaid] = useState<number | "">("");
  const [method, setMethod] = useState<PayingMethod>("wave");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subtotal = lines.reduce((s, l) => s + Math.round((Number(l.quantity) || 0) * l.product.salePrice), 0);
  const total = subtotal + (Number(deliveryFee) || 0);

  function submit() {
    setError(null);
    if (!customerId) return setError("Choisissez le client de la commande.");
    if (lines.length === 0) return setError("Ajoutez au moins un produit.");
    startTransition(async () => {
      const res = await createOrder({
        customerId,
        channel,
        items: lines.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity) })),
        deliveryFee: Number(deliveryFee) || 0,
        deliveryAddress: address,
        amountPaid: Number(paid) || 0,
        paymentMethod: Number(paid) > 0 ? method : null,
        note,
      });
      if (!res.ok) return setError(res.error);
      toast.success("Commande enregistrée — les produits sont réservés");
      router.push(`/commandes/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5">
            <FormField label="Client">
              <CustomerCombobox
                customers={customers}
                value={customerId}
                onChange={(id) => {
                  setCustomerId(id);
                  setError(null);
                }}
                onCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name, "fr")))}
              />
            </FormField>
            <FormField label="Canal de la commande">
              <div className="flex flex-wrap gap-2">
                {ORDER_CHANNELS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    aria-pressed={channel === c}
                    className={cn(
                      "h-10 rounded-full border bg-card px-4 text-sm font-medium text-muted-foreground",
                      channel === c && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {CHANNELS[c]}
                  </button>
                ))}
              </div>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <h2 className="font-bold">Produits commandés</h2>
            {lines.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
                <ShoppingBag className="size-8 text-primary" />
                Les produits ajoutés seront réservés pour ce client.
              </div>
            )}
            <ul className="space-y-3">
              {lines.map((l, i) => (
                <li key={l.product.id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-3">
                  <ProductThumb name={l.product.name} imageUrl={l.product.imageUrl} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.product.name}</p>
                    <p className="num text-xs text-muted-foreground">
                      {formatFCFA(l.product.salePrice)} · dispo {formatQty(l.product.available, l.product.unit)}
                    </p>
                  </div>
                  <QtyStepper
                    className="w-36"
                    value={l.quantity}
                    unit={l.product.unit}
                    max={l.product.available}
                    onChange={(v) => setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, quantity: v } : x)))}
                  />
                  <span className="num w-24 text-right font-semibold">
                    {formatFCFA(Math.round((Number(l.quantity) || 0) * l.product.salePrice))}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Retirer ${l.product.name}`}
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <ProductPicker
              products={products.filter((p) => p.available > 0)}
              excludeIds={lines.map((l) => l.product.id)}
              onSelect={(p) => setLines((prev) => [...prev, { product: p, quantity: 1 }])}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-4">
            <FormField label="Adresse de livraison" htmlFor="address">
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Quartier, repère…" />
            </FormField>
            <FormField label="Frais de livraison" htmlFor="fee">
              <SuffixInput
                id="fee"
                suffix="FCFA"
                min={0}
                step={1}
                inputMode="numeric"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0"
              />
            </FormField>
            <FormField label="Déjà payé (acompte)" htmlFor="paid" hint="Laissez vide si le client paie à la livraison.">
              <SuffixInput
                id="paid"
                suffix="FCFA"
                min={0}
                max={total}
                step={1}
                inputMode="numeric"
                value={paid}
                onChange={(e) => setPaid(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0"
              />
            </FormField>
            {Number(paid) > 0 && (
              <PaymentMethodPicker value={method} onChange={(m) => m !== "credit" && setMethod(m)} methods={PAYING_METHODS} />
            )}
            <FormField label="Note (facultative)" htmlFor="note">
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Taille, couleur, heure de livraison…" />
            </FormField>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Produits</dt>
                <dd className="num">{formatFCFA(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Livraison</dt>
                <dd className="num">{formatFCFA(Number(deliveryFee) || 0)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <dt className="font-bold">Total</dt>
                <dd className="num text-2xl font-extrabold">{formatFCFA(total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <FormError message={error} />
        <Button size="lg" className="w-full" disabled={pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          Enregistrer la commande
        </Button>
      </div>
    </div>
  );
}

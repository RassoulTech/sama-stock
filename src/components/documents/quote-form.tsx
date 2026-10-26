"use client";

import { FileText, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CustomerCombobox } from "@/components/customers/customer-combobox";
import type { CustomerOption } from "@/components/customers/customer-dialog";
import { ProductThumb } from "@/components/products/product-thumb";
import { FormError, FormField, SuffixInput } from "@/components/shared/form-field";
import { ProductPicker, type PickerProduct } from "@/components/shared/product-picker";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA, formatPhone, formatQty } from "@/lib/format";
import { saveQuote } from "@/server/actions/documents";

export interface QuoteInitial {
  id: string;
  customerId: string | null;
  customer: { name: string; phone?: string | null; address?: string | null; ninea?: string | null };
  lines: { product: PickerProduct; quantity: number; unitPrice: number }[];
  discount: number;
  deliveryFee: number;
  validUntil: string;
  note: string | null;
}

type Line = { product: PickerProduct; quantity: number | ""; unitPrice: number | "" };

/** Création et modification d'un devis : les prix sont modifiables, le stock n'est pas réservé. */
export function QuoteForm({
  products,
  customers: initialCustomers,
  defaultValidUntil,
  initial,
}: {
  products: PickerProduct[];
  customers: CustomerOption[];
  defaultValidUntil: string;
  initial?: QuoteInitial;
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState<string | null>(initial?.customerId ?? null);
  const [name, setName] = useState(initial?.customerId ? "" : (initial?.customer.name ?? ""));
  const [phone, setPhone] = useState(initial?.customerId || !initial?.customer.phone ? "" : formatPhone(initial.customer.phone));
  const [address, setAddress] = useState(initial?.customer.address ?? "");
  const [ninea, setNinea] = useState(initial?.customer.ninea ?? "");
  const [lines, setLines] = useState<Line[]>(initial?.lines ?? []);
  const [discount, setDiscount] = useState<number | "">(initial?.discount || "");
  const [deliveryFee, setDeliveryFee] = useState<number | "">(initial?.deliveryFee || "");
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? defaultValidUntil);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lineTotal = (l: Line) => Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0));
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const total = subtotal - (Number(discount) || 0) + (Number(deliveryFee) || 0);
  const update = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  function submit() {
    setError(null);
    if (!customerId && name.trim().length < 2) return setError("Choisissez le client, ou écrivez son nom.");
    if (lines.length === 0) return setError("Ajoutez au moins un produit.");
    startTransition(async () => {
      const chosen = customers.find((c) => c.id === customerId);
      const res = await saveQuote(initial?.id ?? null, {
        customerId,
        customer: { name: chosen?.name ?? name, phone: chosen ? "" : phone, address, ninea },
        items: lines.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) || 0 })),
        discount: Number(discount) || 0,
        deliveryFee: Number(deliveryFee) || 0,
        validUntil,
        note,
      });
      if (!res.ok) return setError(res.error);
      toast.success(initial ? "Devis modifié" : "Devis enregistré");
      router.push(`/factures/devis/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5">
            <FormField label="Client" hint={customerId ? undefined : "Choisissez un client enregistré, ou écrivez simplement son nom ci-dessous."}>
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
            {!customerId && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nom du client" htmlFor="q-name">
                  <Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Entreprise Diallo BTP" />
                </FormField>
                <FormField label="Téléphone" htmlFor="q-phone">
                  <Input id="q-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </FormField>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Adresse (facultative)" htmlFor="q-address">
                <Input id="q-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Quartier, ville…" />
              </FormField>
              <FormField label="NINEA du client (entreprise)" htmlFor="q-ninea">
                <Input id="q-ninea" value={ninea} onChange={(e) => setNinea(e.target.value)} autoCapitalize="characters" />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <h2 className="font-semibold">Produits du devis</h2>
            {lines.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
                <FileText className="size-8 text-primary" />
                Ajoutez les produits. Vous pouvez changer le prix d&apos;une ligne pour ce client.
              </div>
            )}
            <ul className="space-y-3">
              {lines.map((l, i) => (
                <li key={l.product.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                  <ProductThumb name={l.product.name} imageUrl={l.product.imageUrl} className="size-10" />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate font-semibold">{l.product.name}</p>
                    <p className="num text-xs text-muted-foreground">
                      Prix habituel {formatFCFA(l.product.salePrice)} · en stock {formatQty(l.product.available, l.product.unit)}
                    </p>
                  </div>
                  <QtyStepper className="w-36" value={l.quantity} unit={l.product.unit} onChange={(v) => update(i, { quantity: v })} />
                  <SuffixInput
                    aria-label={`Prix unitaire de ${l.product.name}`}
                    className="w-36"
                    suffix="FCFA"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={l.unitPrice}
                    onChange={(e) => update(i, { unitPrice: e.target.value === "" ? "" : Number(e.target.value) })}
                  />
                  <span className="num w-24 text-right font-semibold">{formatFCFA(lineTotal(l))}</span>
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
              products={products}
              excludeIds={lines.map((l) => l.product.id)}
              onSelect={(p) => setLines((prev) => [...prev, { product: p, quantity: 1, unitPrice: p.salePrice }])}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-4">
            <FormField label="Remise" htmlFor="q-discount">
              <SuffixInput
                id="q-discount"
                suffix="FCFA"
                min={0}
                step={1}
                inputMode="numeric"
                value={discount}
                onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0"
              />
            </FormField>
            <FormField label="Livraison ou transport" htmlFor="q-fee">
              <SuffixInput
                id="q-fee"
                suffix="FCFA"
                min={0}
                step={1}
                inputMode="numeric"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0"
              />
            </FormField>
            <FormField label="Valable jusqu'au" htmlFor="q-valid">
              <Input id="q-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </FormField>
            <FormField label="Note (facultative)" htmlFor="q-note">
              <Textarea id="q-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Délai de livraison, conditions…" />
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
              {Number(discount) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Remise</dt>
                  <dd className="num">−{formatFCFA(Number(discount))}</dd>
                </div>
              )}
              {Number(deliveryFee) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Livraison</dt>
                  <dd className="num">{formatFCFA(Number(deliveryFee))}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <dt className="font-semibold">Total</dt>
                <dd className="num text-2xl font-semibold">{formatFCFA(total)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <FormError message={error} />
        <Button size="lg" className="w-full" disabled={pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          {initial ? "Enregistrer les changements" : "Enregistrer le devis"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { ArrowRight, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductThumb } from "@/components/products/product-thumb";
import { FormError, FormField } from "@/components/shared/form-field";
import { ProductPicker, type PickerProduct } from "@/components/shared/product-picker";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatQty } from "@/lib/format";
import { createTransfer } from "@/server/actions/stock";

export function TransferForm({
  products,
  fromName,
  destinations,
}: {
  products: PickerProduct[];
  fromName: string;
  destinations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [to, setTo] = useState(destinations[0]?.id ?? "");
  const [lines, setLines] = useState<{ product: PickerProduct; quantity: number | "" }[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (lines.length === 0) return setError("Ajoutez au moins un produit.");
    startTransition(async () => {
      const res = await createTransfer({
        toLocationId: to,
        note,
        items: lines.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity) })),
      });
      if (!res.ok) return setError(res.error);
      toast.success("Transfert effectué");
      router.push("/stock/historique");
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="space-y-5">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <FormField label="Depuis">
            <div className="flex h-11 items-center rounded-xl bg-muted px-3.5 text-sm font-semibold">{fromName}</div>
          </FormField>
          <ArrowRight className="mx-auto mb-3 hidden size-5 text-muted-foreground sm:block" />
          <FormField label="Vers">
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <ul className="space-y-3">
          {lines.map((l, i) => (
            <li key={l.product.id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-3">
              <ProductThumb name={l.product.name} imageUrl={l.product.imageUrl} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.product.name}</p>
                <p className="num text-xs text-muted-foreground">
                  Disponible : {formatQty(l.product.available, l.product.unit)}
                </p>
              </div>
              <QtyStepper
                className="w-36"
                value={l.quantity}
                unit={l.product.unit}
                max={l.product.available}
                onChange={(v) => setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, quantity: v } : x)))}
              />
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
          showPrice="none"
          onSelect={(p) => setLines((prev) => [...prev, { product: p, quantity: 1 }])}
        />
        <FormField label="Note (facultative)" htmlFor="note">
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <FormError message={error} />
        <Button type="button" size="lg" className="w-full" disabled={pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          Transférer
        </Button>
      </CardContent>
    </Card>
  );
}

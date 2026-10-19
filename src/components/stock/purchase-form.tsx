"use client";

import { Loader2, PackagePlus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductThumb } from "@/components/products/product-thumb";
import { FormError, FormField, SuffixInput } from "@/components/shared/form-field";
import { ProductPicker, type PickerProduct } from "@/components/shared/product-picker";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA, formatQty, unitLabel } from "@/lib/format";
import { createPurchase } from "@/server/actions/stock";

interface Line {
  product: PickerProduct;
  quantity: number | "";
  unitCost: number | "";
}

const NONE = "__none__";

export function PurchaseForm({
  products,
  suppliers: initialSuppliers,
  showCost,
  canCreateSupplier,
  initialProductId,
}: {
  products: PickerProduct[];
  suppliers: { id: string; name: string }[];
  showCost: boolean;
  canCreateSupplier: boolean;
  initialProductId?: string;
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [supplierId, setSupplierId] = useState(NONE);
  const [lines, setLines] = useState<Line[]>(() => {
    const p = products.find((x) => x.id === initialProductId);
    return p ? [{ product: p, quantity: 1, unitCost: p.costPrice ?? "" }] : [];
  });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    setError(null);
    if (lines.length === 0) return setError("Ajoutez au moins un produit.");
    if (lines.some((l) => !l.quantity || Number(l.quantity) <= 0)) return setError("Chaque quantité doit être supérieure à 0.");
    startTransition(async () => {
      const res = await createPurchase({
        supplierId: supplierId === NONE ? null : supplierId,
        note,
        items: lines.map((l) => ({
          productId: l.product.id,
          quantity: Number(l.quantity),
          unitCost: showCost && l.unitCost !== "" ? Number(l.unitCost) : null,
        })),
      });
      if (!res.ok) return setError(res.error);
      toast.success("Entrée de stock enregistrée");
      router.push("/stock");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <Card>
        <CardContent className="space-y-4">
          <h2 className="font-bold">Produits reçus</h2>
          {lines.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
              <PackagePlus className="size-8 text-primary" />
              Ajoutez les produits que vous venez de recevoir.
            </div>
          )}
          <ul className="space-y-3">
            {lines.map((l, i) => (
              <li key={l.product.id} className="rounded-2xl border p-3">
                <div className="flex items-center gap-3">
                  <ProductThumb name={l.product.name} imageUrl={l.product.imageUrl} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.product.name}</p>
                    <p className="num text-xs text-muted-foreground">
                      En stock : {formatQty(l.product.available, l.product.unit)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Retirer ${l.product.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className={`mt-3 grid gap-3 ${showCost ? "sm:grid-cols-2" : ""}`}>
                  <FormField label={`Quantité (${unitLabel(l.product.unit, 2)})`}>
                    <QtyStepper value={l.quantity} onChange={(v) => update(i, { quantity: v })} unit={l.product.unit} />
                  </FormField>
                  {showCost && (
                    <FormField label="Prix d'achat unitaire">
                      <SuffixInput
                        suffix="FCFA"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={l.unitCost}
                        onChange={(e) => update(i, { unitCost: e.target.value === "" ? "" : Number(e.target.value) })}
                        aria-label={`Prix d'achat de ${l.product.name}`}
                      />
                    </FormField>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <ProductPicker
            products={products}
            excludeIds={lines.map((l) => l.product.id)}
            showPrice={showCost ? "cost" : "none"}
            onSelect={(p) => setLines((prev) => [...prev, { product: p, quantity: 1, unitCost: p.costPrice ?? "" }])}
          />
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-4">
            <FormField label="Fournisseur (facultatif)">
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun fournisseur</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {canCreateSupplier && (
              <SupplierDialog
                trigger={
                  <Button type="button" variant="ghost" size="sm" className="-mt-1">
                    <Plus /> Nouveau fournisseur
                  </Button>
                }
                onSaved={(s) => {
                  setSuppliers((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
                  setSupplierId(s.id);
                }}
              />
            )}
            <FormField label="Note (facultative)" htmlFor="note">
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="N° de facture, remarque…" />
            </FormField>
            {showCost && (
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                <span className="text-sm text-muted-foreground">Total de l&apos;achat</span>
                <span className="num text-lg font-extrabold">{formatFCFA(total)}</span>
              </div>
            )}
            {showCost && (
              <p className="text-xs text-muted-foreground">
                Le prix d&apos;achat de chaque produit sera recalculé en coût moyen.
              </p>
            )}
          </CardContent>
        </Card>
        <FormError message={error} />
        <Button type="button" size="lg" className="w-full" disabled={pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          Valider l&apos;entrée
        </Button>
      </div>
    </div>
  );
}

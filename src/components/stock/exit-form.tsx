"use client";

import { ArrowUpFromLine, Loader2, ShieldAlert } from "lucide-react";
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
import { formatQty, unitLabel } from "@/lib/format";
import { EXIT_REASONS, LOSS_REASONS } from "@/lib/domain/stock";
import { cn } from "@/lib/utils";
import { createStockExit } from "@/server/actions/stock";

export type ExitProduct = PickerProduct & { physical: number };

export function ExitForm({ products, initialProductId }: { products: ExitProduct[]; initialProductId?: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<ExitProduct | null>(products.find((p) => p.id === initialProductId) ?? null);
  const [kind, setKind] = useState<"exit" | "loss">("loss");
  const [reason, setReason] = useState<string>("breakage");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reasons = kind === "exit" ? EXIT_REASONS : LOSS_REASONS;

  function changeKind(k: "exit" | "loss") {
    setKind(k);
    setReason(k === "exit" ? "sold_offline" : "breakage");
  }

  function submit() {
    setError(null);
    if (!product) return setError("Choisissez un produit.");
    if (!quantity || quantity <= 0) return setError("La quantité doit être supérieure à 0.");
    startTransition(async () => {
      const res = await createStockExit({ productId: product.id, quantity, kind, reason, note });
      if (!res.ok) return setError(res.error);
      toast.success(kind === "loss" ? "Perte enregistrée" : "Sortie enregistrée");
      router.push(`/produits/${product.id}`);
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="space-y-5">
        <FormField label="Produit">
          {product ? (
            <div className="flex items-center gap-3 rounded-2xl border p-3">
              <ProductThumb name={product.name} imageUrl={product.imageUrl} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{product.name}</p>
                <p className="num text-xs text-muted-foreground">En rayon : {formatQty(product.physical, product.unit)}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setProduct(null)}>
                Changer
              </Button>
            </div>
          ) : (
            <ProductPicker
              products={products}
              label="Choisir le produit"
              showPrice="none"
              onSelect={(p) => setProduct(products.find((x) => x.id === p.id) ?? null)}
            />
          )}
        </FormField>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
          {(
            [
              ["loss", "Perte", ShieldAlert, "Casse, vol, péremption…"],
              ["exit", "Sortie", ArrowUpFromLine, "Vendu hors caisse, offert…"],
            ] as const
          ).map(([k, label, Icon, hint]) => (
            <button
              key={k}
              type="button"
              onClick={() => changeKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors",
                kind === k && "bg-card text-foreground shadow-sm",
              )}
            >
              <span className="flex items-center gap-1.5">
                <Icon className="size-4" /> {label}
              </span>
              <span className="text-[11px] font-normal">{hint}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Motif">
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(reasons).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={`Quantité${product ? ` (${unitLabel(product.unit, 2)})` : ""}`}>
            <QtyStepper value={quantity} onChange={setQuantity} unit={product?.unit ?? "piece"} max={product?.physical} />
          </FormField>
        </div>

        <FormField label="Note (facultative)" htmlFor="note">
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce qui s'est passé…" />
        </FormField>

        <FormError message={error} />
        <Button type="button" size="lg" className="w-full" disabled={pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          Enregistrer {kind === "loss" ? "la perte" : "la sortie"}
        </Button>
      </CardContent>
    </Card>
  );
}

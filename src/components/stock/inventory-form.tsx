"use client";

import { Check, ClipboardCheck, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductThumb } from "@/components/products/product-thumb";
import { FormError } from "@/components/shared/form-field";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { SignedQty } from "@/components/stock/movement-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA, formatQty, unitAllowsDecimals } from "@/lib/format";
import { cn } from "@/lib/utils";
import { submitInventory, type InventoryLine } from "@/server/actions/stock";

export interface InventoryProduct {
  id: string;
  name: string;
  unit: string;
  physical: number;
  imageUrl: string | null;
  categoryName: string | null;
}

export function InventoryForm({ products, showCost }: { products: InventoryProduct[]; showCost: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, number | "">>({});
  const [result, setResult] = useState<{ lines: InventoryLine[]; checked: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counted = Object.entries(counts).filter(([, v]) => v !== "");
  const visible = products.filter((p) => matchesSearch(q, p.name, p.categoryName));

  function submit() {
    setError(null);
    if (counted.length === 0) return setError("Saisissez au moins une quantité comptée.");
    startTransition(async () => {
      const res = await submitInventory({ counts: counted.map(([productId, v]) => ({ productId, counted: Number(v) })) });
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      setCounts({});
      toast.success("Inventaire enregistré");
      router.refresh();
    });
  }

  if (result) {
    const losses = result.lines.filter((l) => l.difference < 0);
    const lossValue = losses.reduce((s, l) => s + l.value, 0);
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardCheck className="size-5 text-primary" /> Inventaire terminé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {result.checked} produit{result.checked > 1 ? "s" : ""} compté{result.checked > 1 ? "s" : ""} ·{" "}
            {result.lines.length === 0 ? "aucun écart, bravo !" : `${result.lines.length} écart(s) corrigé(s)`}
          </p>
          {showCost && lossValue < 0 && (
            <div className="rounded-xl bg-destructive/10 p-4 text-destructive">
              <p className="text-sm font-medium">Valeur des produits manquants</p>
              <p className="num text-2xl font-semibold">{formatFCFA(-lossValue)}</p>
            </div>
          )}
          {result.lines.length > 0 && (
            <ul className="divide-y rounded-xl border">
              {result.lines.map((l) => (
                <li key={l.productId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.name}</p>
                    <p className="num text-xs text-muted-foreground">
                      Attendu {formatQty(l.expected, l.unit)} · compté {formatQty(l.counted, l.unit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <SignedQty quantity={l.difference} unit={l.unit} />
                    {showCost && l.value !== 0 && (
                      <p className="num text-xs text-muted-foreground">{formatFCFA(l.value)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" onClick={() => setResult(null)}>
            <RotateCcw /> Nouvel inventaire
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-accent/60 p-4 text-sm text-accent-foreground">
        Comptez vos produits et saisissez la quantité réelle. Laissez vide ce que vous n&apos;avez pas compté. Le
        bouton <Check className="inline size-3.5" /> indique « quantité conforme ».
      </div>
      <SearchInput value={q} onChange={setQ} placeholder="Rechercher un produit…" />
      <ul className="space-y-2">
        {visible.map((p) => {
          const value = counts[p.id] ?? "";
          const diff = value === "" ? null : Number(value) - p.physical;
          return (
            <li
              key={p.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 border",
                diff !== null && diff !== 0 && "ring-saffron/60",
              )}
            >
              <ProductThumb name={p.name} imageUrl={p.imageUrl} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="num text-xs text-muted-foreground">Attendu : {formatQty(p.physical, p.unit)}</p>
              </div>
              <div className="flex items-center gap-2">
                {diff !== null && diff !== 0 && <SignedQty quantity={diff} unit={p.unit} className="text-xs" />}
                <input
                  type="number"
                  inputMode={unitAllowsDecimals(p.unit) ? "decimal" : "numeric"}
                  min={0}
                  step={unitAllowsDecimals(p.unit) ? "0.001" : "1"}
                  value={value}
                  placeholder="Compté"
                  aria-label={`Quantité comptée pour ${p.name}`}
                  onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value === "" ? "" : Number(e.target.value) }))}
                  className="num h-11 w-24 rounded-xl border border-input bg-card px-3 text-center text-base font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                />
                <Button
                  type="button"
                  variant={value !== "" && diff === 0 ? "default" : "outline"}
                  size="icon"
                  aria-label={`${p.name} : quantité conforme`}
                  onClick={() => setCounts((c) => ({ ...c, [p.id]: p.physical }))}
                >
                  <Check />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-24 z-20 lg:bottom-4">
        <FormError message={error} />
        <Button type="button" size="lg" className="mt-2 w-full shadow-lg" disabled={pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          Valider l&apos;inventaire ({counted.length} produit{counted.length > 1 ? "s" : ""} compté
          {counted.length > 1 ? "s" : ""})
        </Button>
      </div>
    </div>
  );
}

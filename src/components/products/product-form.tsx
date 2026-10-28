"use client";

import { AlertTriangle, Loader2, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError, FormField, SuffixInput } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatFCFA, UNITS, unitAllowsDecimals, unitLabel } from "@/lib/format";
import { createProduct, updateProduct } from "@/server/actions/products";
import { ProductImageInput } from "./product-image-input";

const NEW_CATEGORY = "__new__";
const NO_CATEGORY = "__none__";

export interface ProductFormValues {
  name: string;
  reference: string;
  unit: string;
  categoryId: string | null;
  salePrice: number | "";
  costPrice: number | "";
  alertThreshold: number | "";
  imageData: string | null;
}

export function ProductForm({
  productId,
  categories,
  defaults,
  stock,
}: {
  productId?: string;
  categories: { id: string; name: string }[];
  defaults?: ProductFormValues;
  /** Modification : quantité en rayon dans la boutique en cours, corrigeable (absent pour un produit archivé). */
  stock?: { seen: number; locationName: string };
}) {
  const router = useRouter();
  const isEdit = Boolean(productId);
  const [values, setValues] = useState<ProductFormValues>(
    defaults ?? {
      name: "",
      reference: "",
      unit: "piece",
      categoryId: null,
      salePrice: "",
      costPrice: "",
      alertThreshold: 5,
      imageData: null,
    },
  );
  const [imageTouched, setImageTouched] = useState(false);
  const [categoryChoice, setCategoryChoice] = useState(values.categoryId ?? NO_CATEGORY);
  const [newCategory, setNewCategory] = useState("");
  const [initialStock, setInitialStock] = useState<number | "">("");
  const [counted, setCounted] = useState<number | "">(stock?.seen ?? "");
  /** Le stock n'est envoyé que s'il a été touché : sinon une vente faite entre-temps serait écrasée. */
  const [stockTouched, setStockTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof ProductFormValues>(key: K, v: ProductFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const sale = Number(values.salePrice) || 0;
  const cost = Number(values.costPrice) || 0;
  const margin = sale - cost;
  const marginPct = sale > 0 ? Math.round((margin / sale) * 100) : 0;
  const step = unitAllowsDecimals(values.unit) ? "0.001" : "1";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: values.name,
      reference: values.reference,
      unit: values.unit,
      categoryId: categoryChoice === NO_CATEGORY || categoryChoice === NEW_CATEGORY ? null : categoryChoice,
      newCategory: categoryChoice === NEW_CATEGORY ? newCategory : "",
      salePrice: values.salePrice === "" ? 0 : values.salePrice,
      costPrice: values.costPrice === "" ? 0 : values.costPrice,
      alertThreshold: values.alertThreshold === "" ? 0 : values.alertThreshold,
      initialStock: initialStock === "" ? 0 : initialStock,
      stock: isEdit && stock && stockTouched && counted !== "" ? { seen: stock.seen, counted } : undefined,
      // En modification, on n'envoie la photo que si elle a changé
      imageData: isEdit && !imageTouched ? undefined : (values.imageData ?? ""),
    };
    if (categoryChoice === NEW_CATEGORY && !newCategory.trim()) {
      setError("Donnez un nom à la nouvelle catégorie.");
      return;
    }
    startTransition(async () => {
      const res = isEdit ? await updateProduct(productId!, payload) : await createProduct(payload);
      if (!res.ok) {
        setError(res.error);
        // Stock changé entre-temps : on relit la quantité en rayon pour le prochain essai
        if (isEdit) router.refresh();
        return;
      }
      toast.success(isEdit ? "Produit mis à jour" : "Produit ajouté");
      router.push(`/produits/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <Card>
        <CardContent className="space-y-5">
          <ProductImageInput
            value={values.imageData}
            onChange={(v) => {
              set("imageData", v);
              setImageTouched(true);
            }}
          />
          <FormField label="Nom du produit" htmlFor="name">
            <Input
              id="name"
              required
              minLength={2}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex. Sac de ciment 50 kg"
            />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Catégorie">
              <Select value={categoryChoice} onValueChange={setCategoryChoice}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sans catégorie</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_CATEGORY}>+ Nouvelle catégorie…</SelectItem>
                </SelectContent>
              </Select>
              {categoryChoice === NEW_CATEGORY && (
                <Input
                  autoFocus
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nom de la catégorie"
                  aria-label="Nom de la nouvelle catégorie"
                />
              )}
            </FormField>
            <FormField label="Unité de vente">
              <Select value={values.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Référence (facultative)" htmlFor="reference" hint="Code interne ou code fournisseur.">
            <Input
              id="reference"
              value={values.reference}
              onChange={(e) => set("reference", e.target.value)}
              placeholder="Ex. CIM-50"
            />
          </FormField>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-5">
            <FormField label="Prix d'achat" htmlFor="costPrice" hint="Ce que vous payez au fournisseur, par unité.">
              <SuffixInput
                id="costPrice"
                suffix="FCFA"
                min={0}
                step={1}
                inputMode="numeric"
                value={values.costPrice}
                onChange={(e) => set("costPrice", e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0"
              />
            </FormField>
            <FormField label="Prix de vente" htmlFor="salePrice">
              <SuffixInput
                id="salePrice"
                suffix="FCFA"
                required
                min={0}
                step={1}
                inputMode="numeric"
                value={values.salePrice}
                onChange={(e) => set("salePrice", e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0"
              />
            </FormField>
            {sale > 0 &&
              (margin < 0 ? (
                <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <strong>Vente à perte :</strong> vous perdez {formatFCFA(-margin)} sur chaque{" "}
                    {unitLabel(values.unit)} vendu(e).
                  </span>
                </p>
              ) : (
                <p className="flex items-center gap-2 rounded-xl bg-accent p-3 text-sm text-accent-foreground">
                  <TrendingUp className="size-4 shrink-0" />
                  Marge : <strong className="num">{formatFCFA(margin)}</strong> ({marginPct} %)
                </p>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-5">
            <FormField
              label="Seuil d'alerte"
              htmlFor="alertThreshold"
              hint="Vous serez prévenu quand le stock descend à ce niveau."
            >
              <SuffixInput
                id="alertThreshold"
                suffix={unitLabel(values.unit, 2)}
                min={0}
                step={step}
                inputMode="decimal"
                value={values.alertThreshold}
                onChange={(e) => set("alertThreshold", e.target.value === "" ? "" : Number(e.target.value))}
              />
            </FormField>
            {isEdit && stock && (
              <FormField
                label={`Stock en rayon · ${stock.locationName}`}
                htmlFor="stockCount"
                hint="Corrigez la quantité si elle est fausse. La différence est notée dans l'historique du stock, sans compter comme une perte."
              >
                <SuffixInput
                  id="stockCount"
                  suffix={unitLabel(values.unit, 2)}
                  min={0}
                  step={step}
                  inputMode="decimal"
                  value={counted}
                  onChange={(e) => {
                    setStockTouched(true);
                    setCounted(e.target.value === "" ? "" : Number(e.target.value));
                  }}
                />
              </FormField>
            )}
            {!isEdit && (
              <FormField label="Stock de départ" htmlFor="initialStock" hint="Quantité que vous avez aujourd'hui.">
                <SuffixInput
                  id="initialStock"
                  suffix={unitLabel(values.unit, 2)}
                  min={0}
                  step={step}
                  inputMode="decimal"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                />
              </FormField>
            )}
          </CardContent>
        </Card>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {isEdit ? "Enregistrer les modifications" : "Ajouter le produit"}
        </Button>
      </div>
    </form>
  );
}

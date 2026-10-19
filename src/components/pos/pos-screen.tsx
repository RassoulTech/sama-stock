"use client";

import { Minus, PackageSearch, Percent, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { CustomerOption } from "@/components/customers/customer-dialog";
import { ProductThumb } from "@/components/products/product-thumb";
import { EmptyState } from "@/components/shared/empty-state";
import { SuffixInput } from "@/components/shared/form-field";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatFCFA, formatQty, unitAllowsDecimals, unitLabel } from "@/lib/format";
import { roundQty } from "@/lib/domain/stock";
import { cn } from "@/lib/utils";
import { createSale } from "@/server/actions/sales";
import { CheckoutDialog, type CheckoutResult } from "./checkout-dialog";

export interface PosProduct {
  id: string;
  name: string;
  unit: string;
  salePrice: number;
  available: number;
  imageUrl: string | null;
  categoryId: string | null;
}

export function PosScreen({
  products,
  categories,
  customers: initialCustomers,
}: {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [discount, setDiscount] = useState<number | "">("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customers, setCustomers] = useState(initialCustomers);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = [...cart.entries()]
    .map(([id, qty]) => ({ product: byId.get(id)!, qty }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + Math.round(l.qty * l.product.salePrice), 0);
  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - discountValue;
  const itemCount = lines.length;

  const visible = products.filter(
    (p) => matchesSearch(q, p.name) && (category === "all" || p.categoryId === category),
  );

  function setQty(id: string, qty: number) {
    const product = byId.get(id);
    if (!product) return;
    const clamped = Math.min(roundQty(qty), product.available);
    setCart((prev) => {
      const next = new Map(prev);
      if (clamped <= 0) next.delete(id);
      else next.set(id, clamped);
      return next;
    });
  }

  function add(id: string) {
    setQty(id, (cart.get(id) ?? 0) + 1);
  }

  function checkout(result: CheckoutResult) {
    setError(null);
    startTransition(async () => {
      const res = await createSale({
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        discount: discountValue,
        ...result,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/ventes/${res.data.id}?nouvelle=1`);
      router.refresh();
    });
  }

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShoppingCart className="size-5 text-primary" /> Panier
          {itemCount > 0 && <span className="num rounded-full bg-primary px-2 text-xs text-primary-foreground">{itemCount}</span>}
        </h2>
        {itemCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setCart(new Map())}>
            Vider
          </Button>
        )}
      </div>
      {itemCount === 0 ? (
        <div className="grid flex-1 place-items-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Touchez un produit pour l&apos;ajouter au panier.
        </div>
      ) : (
        <ul className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
          {lines.map(({ product, qty }) => (
            <li key={product.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{product.name}</p>
                  <p className="num text-xs text-muted-foreground">{formatFCFA(product.salePrice)} / {unitLabel(product.unit)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setQty(product.id, 0)}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label={`Retirer ${product.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center rounded-xl bg-muted">
                  <button
                    type="button"
                    className="grid size-10 place-items-center"
                    onClick={() => setQty(product.id, qty - 1)}
                    aria-label="Diminuer"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    type="number"
                    value={qty}
                    min={0}
                    step={unitAllowsDecimals(product.unit) ? "0.001" : "1"}
                    inputMode={unitAllowsDecimals(product.unit) ? "decimal" : "numeric"}
                    onChange={(e) => setQty(product.id, Number(e.target.value))}
                    aria-label={`Quantité de ${product.name}`}
                    className="num w-14 bg-transparent text-center font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    className="grid size-10 place-items-center disabled:opacity-30"
                    onClick={() => setQty(product.id, qty + 1)}
                    disabled={qty >= product.available}
                    aria-label="Augmenter"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <span className="num font-semibold">{formatFCFA(Math.round(qty * product.salePrice))}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-3 border-t pt-3">
        {showDiscount ? (
          <div className="flex items-center gap-2">
            <SuffixInput
              suffix="FCFA"
              min={0}
              max={subtotal}
              step={1}
              inputMode="numeric"
              placeholder="Remise"
              aria-label="Remise"
              value={discount}
              onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Retirer la remise"
              onClick={() => {
                setShowDiscount(false);
                setDiscount("");
              }}
            >
              <X />
            </Button>
          </div>
        ) : (
          itemCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowDiscount(true)}>
              <Percent /> Ajouter une remise
            </Button>
          )
        )}
        <dl className="space-y-1 text-sm">
          {discountValue > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <dt>Sous-total</dt>
                <dd className="num">{formatFCFA(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Remise</dt>
                <dd className="num">−{formatFCFA(discountValue)}</dd>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between">
            <dt className="font-semibold">Total</dt>
            <dd className="num text-2xl font-semibold">{formatFCFA(total)}</dd>
          </div>
        </dl>
        <Button
          size="lg"
          variant="saffron"
          className="w-full"
          disabled={itemCount === 0}
          onClick={() => {
            setError(null);
            setCheckoutOpen(true);
          }}
        >
          Encaisser {itemCount > 0 && formatFCFA(total)}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
        <section className="space-y-4">
          <SearchInput value={q} onChange={setQ} placeholder="Rechercher un produit…" />
          {categories.length > 0 && (
            <div className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {[{ id: "all", name: "Tout" }, ...categories].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "h-8 shrink-0 rounded-full border bg-card px-3 text-[0.8125rem] font-medium text-muted-foreground",
                    category === c.id && "border-primary/30 bg-accent text-accent-foreground",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {visible.length === 0 ? (
            <EmptyState icon={PackageSearch} title="Aucun produit" description="Vérifiez l'orthographe ou la catégorie." />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((p) => {
                const inCart = cart.get(p.id) ?? 0;
                const out = p.available <= 0;
                const maxed = inCart >= p.available;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={out || maxed}
                      onClick={() => add(p.id)}
                      className={cn(
                        "surface group relative flex h-full w-full flex-col gap-3 p-3 text-left transition-[border-color,box-shadow] hover:border-primary/40 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
                        inCart > 0 && "border-primary ring-1 ring-primary",
                      )}
                    >
                      {p.imageUrl ? (
                        <ProductThumb name={p.name} imageUrl={p.imageUrl} className="aspect-[4/3] size-auto w-full" />
                      ) : (
                        <ProductThumb name={p.name} imageUrl={null} />
                      )}
                      {inCart > 0 && (
                        <span className="num absolute top-2.5 right-2.5 grid h-6 min-w-6 place-items-center rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                          {formatQty(inCart)}
                        </span>
                      )}
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className="line-clamp-2 text-[0.8125rem] leading-snug font-medium">{p.name}</span>
                        <span className="num mt-auto pt-1.5 text-[0.9375rem] font-semibold">{formatFCFA(p.salePrice)}</span>
                        <span className={cn("num text-xs", out ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {out ? "Rupture" : `${formatQty(p.available, p.unit)} dispo`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="sticky top-24 hidden h-[calc(100dvh-8rem)] rounded-2xl bg-card p-5 border lg:block">
          {cartPanel}
        </aside>
      </div>

      {/* Barre panier mobile */}
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3 lg:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex h-14 w-full items-center justify-between rounded-xl bg-primary px-5 text-primary-foreground shadow-xl shadow-primary/30"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="size-5" /> Panier · {itemCount} article{itemCount > 1 ? "s" : ""}
            </span>
            <span className="num text-lg font-semibold">{formatFCFA(total)}</span>
          </button>
        </div>
      )}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[88dvh] rounded-t-3xl px-4 pb-6">
          <SheetHeader className="sr-only">
            <SheetTitle>Panier</SheetTitle>
          </SheetHeader>
          <div className="h-full pt-4">{cartPanel}</div>
        </SheetContent>
      </Sheet>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        total={total}
        customers={customers}
        onCustomerCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name, "fr")))}
        onConfirm={checkout}
        pending={pending}
        error={error}
      />
    </>
  );
}

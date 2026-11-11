"use client";

import { Check, Minus, PackageSearch, Pencil, Percent, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { usePiloteEcran } from "@/components/assistant/pilote/use-pilote-ecran";
import type { CustomerOption } from "@/components/customers/customer-dialog";
import { ProductThumb } from "@/components/products/product-thumb";
import { EmptyState } from "@/components/shared/empty-state";
import { SuffixInput } from "@/components/shared/form-field";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatFCFA, formatQty, unitAllowsDecimals, unitLabel } from "@/lib/format";
import { roundQty } from "@/lib/domain/stock";
import type { SaleDraft } from "@/lib/offline/types";
import { cn } from "@/lib/utils";
import { CheckoutDialog, type CheckoutDefaults, type CheckoutResult } from "./checkout-dialog";

export interface PosProduct {
  id: string;
  name: string;
  unit: string;
  salePrice: number;
  available: number;
  imageUrl: string | null;
  categoryId: string | null;
}

export interface PosInitial {
  items: { productId: string; quantity: number; unitPrice: number }[];
  discount: number;
  checkout: CheckoutDefaults;
}

export function PosScreen({
  products,
  categories,
  customers: initialCustomers,
  submit,
  allowCustomerCreate = true,
  bottomNav = true,
  initial,
  banner,
}: {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  customers: CustomerOption[];
  /** Enregistre la vente : renvoie un message d'erreur, ou null quand c'est fait. */
  submit: (draft: SaleDraft) => Promise<string | null>;
  allowCustomerCreate?: boolean;
  /** Une barre de navigation est-elle affichée en bas de l'écran (téléphone) ? */
  bottomNav?: boolean;
  /** Correction d'une vente : son panier, sa remise et son paiement de départ. */
  initial?: PosInitial;
  /** Bandeau au-dessus de la caisse (correction en cours). */
  banner?: React.ReactNode;
}) {
  const [cart, setCart] = useState<Map<string, number>>(() => new Map(initial?.items.map((i) => [i.productId, i.quantity])));
  /** Prix négociés avec le client, pour cette vente seulement (la fiche produit ne change pas). */
  const [prices, setPrices] = useState<Map<string, number>>(
    () =>
      new Map(
        initial?.items.flatMap((i) => {
          const product = products.find((p) => p.id === i.productId);
          return product && product.salePrice !== i.unitPrice ? [[i.productId, i.unitPrice] as const] : [];
        }),
      ),
  );
  const [discount, setDiscount] = useState<number | "">(initial?.discount || "");
  const [showDiscount, setShowDiscount] = useState(Boolean(initial?.discount));
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customers, setCustomers] = useState(initialCustomers);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const priceOf = (p: PosProduct) => prices.get(p.id) ?? p.salePrice;
  const lines = [...cart.entries()]
    .map(([id, qty]) => ({ product: byId.get(id)!, qty }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + Math.round(l.qty * priceOf(l.product)), 0);
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
    if (clamped <= 0) setPrice(id, null);
  }

  /** null : retour au prix habituel du produit. */
  function setPrice(id: string, price: number | null) {
    setPrices((prev) => {
      const next = new Map(prev);
      const product = byId.get(id);
      if (price === null || !product || price === product.salePrice) next.delete(id);
      else next.set(id, Math.max(0, Math.round(price)));
      return next;
    });
  }

  function clearCart() {
    setCart(new Map());
    setPrices(new Map());
  }

  function add(id: string) {
    setQty(id, (cart.get(id) ?? 0) + 1);
  }

  function checkout(result: CheckoutResult): Promise<string | null> {
    setError(null);
    const customer = result.customerId ? (customers.find((c) => c.id === result.customerId) ?? null) : null;
    const draft: SaleDraft = {
      clientRef: crypto.randomUUID(),
      items: lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        unit: l.product.unit,
        quantity: l.qty,
        unitPrice: priceOf(l.product),
        negotiated: prices.has(l.product.id),
      })),
      discount: discountValue,
      paymentMethod: result.paymentMethod,
      amountReceived: result.amountReceived,
      customer: customer && { id: customer.id, name: customer.name, phone: customer.phone },
    };
    return new Promise((resolve) => {
      startTransition(async () => {
        const failure = await submit(draft);
        if (failure) {
          setError(failure);
          resolve(failure);
          return;
        }
        setCheckoutOpen(false);
        setCartOpen(false);
        clearCart();
        setDiscount("");
        setShowDiscount(false);
        resolve(null);
      });
    });
  }

  // L'assistant vocal remplit la caisse avec les mêmes fonctions que les doigts du vendeur (jamais en correction)
  usePiloteEcran(
    "vente",
    {
      vider: () => {
        clearCart();
        setDiscount("");
        setShowDiscount(false);
        setQ("");
        setCategory("all");
        setError(null);
      },
      ajouterProduit: (id, quantite) => {
        setQ("");
        setCategory("all");
        setQty(id, quantite);
      },
      prixNegocie: (id, prix) => setPrice(id, prix),
      ouvrirEncaisser: () => {
        setError(null);
        setCheckoutOpen(true);
      },
    },
    !initial,
  );

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pr-10 pb-4 lg:pr-0">
        <h2 className="flex items-center gap-2.5 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-primary">
            <ShoppingCart className="size-[1.125rem]" />
          </span>
          Panier
          {itemCount > 0 && <span className="num grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{itemCount}</span>}
        </h2>
        {itemCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCart}>
            Vider
          </Button>
        )}
      </div>
      {itemCount === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/30 p-6 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-card text-muted-foreground shadow-[0_1px_2px_rgb(11_19_16/0.05)]">
            <ShoppingCart className="size-6" />
          </span>
          <span>
            <span className="block font-semibold">Le panier est vide</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">Touchez un produit pour l&apos;ajouter.</span>
          </span>
        </div>
      ) : (
        <ul className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
          {lines.map(({ product, qty }) => (
            <li key={product.id} className="rounded-2xl border bg-card p-3 shadow-[0_1px_2px_rgb(11_19_16/0.04)]">
              <div className="flex items-start gap-3">
                <ProductThumb name={product.name} imageUrl={product.imageUrl} className="size-11 rounded-xl text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{product.name}</p>
                  <LinePrice product={product} price={priceOf(product)} onChange={(p) => setPrice(product.id, p)} />
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
                <span className="amount text-base font-bold">{formatFCFA(Math.round(qty * priceOf(product)))}</span>
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
          data-assistant="vente.encaisser"
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
      {banner}
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
                      data-assistant={`vente.produit.${p.id}`}
                      className={cn(
                        "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-[0_1px_2px_rgb(11_19_16/0.04),0_10px_28px_-20px_rgb(11_19_16/0.2)] transition-[border-color,box-shadow,transform] duration-150 hover:border-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:active:scale-100",
                        inCart > 0 && "border-primary ring-2 ring-primary/20",
                      )}
                    >
                      <span className="relative block aspect-[16/10] w-full">
                        <ProductThumb
                          name={p.name}
                          imageUrl={p.imageUrl}
                          className="absolute inset-0 size-full rounded-none text-xl ring-0 ring-inset"
                        />
                        <span
                          className={cn(
                            "num absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur-sm",
                            out ? "bg-destructive text-white" : "bg-card/90 text-foreground",
                          )}
                        >
                          {out ? "Rupture" : `${formatQty(p.available, p.unit)} dispo`}
                        </span>
                        {inCart > 0 && (
                          <span className="num absolute top-2 right-2 grid h-7 min-w-7 place-items-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground shadow-[0_6px_14px_-6px_var(--primary)]">
                            {formatQty(inCart)}
                          </span>
                        )}
                      </span>
                      <span className="flex flex-1 items-end gap-2 p-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="line-clamp-2 text-[0.8125rem] leading-snug font-medium">{p.name}</span>
                          <span className="amount text-[0.9375rem] font-bold">{formatFCFA(p.salePrice)}</span>
                        </span>
                        {!out && !maxed && (
                          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            <Plus className="size-4" />
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="sticky top-24 hidden h-[calc(100dvh-8rem)] rounded-[1.75rem] border bg-card p-5 shadow-[0_1px_2px_rgb(11_19_16/0.04),0_18px_40px_-24px_rgb(11_19_16/0.25)] lg:block">
          {cartPanel}
        </aside>
      </div>

      {/* Barre panier mobile */}
      {itemCount > 0 && (
        <div
          className={cn(
            "fixed inset-x-0 z-30 px-4 pb-3 lg:hidden",
            bottomNav ? "bottom-[calc(4rem+env(safe-area-inset-bottom))]" : "bottom-[env(safe-area-inset-bottom)]",
          )}
        >
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            data-assistant="vente.encaisser"
            className="flex h-14 w-full items-center justify-between rounded-full bg-primary pr-5 pl-2 text-primary-foreground shadow-[0_16px_32px_-14px_var(--primary)] transition-transform active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5 font-semibold">
              <span className="num grid size-10 place-items-center rounded-full bg-white/15 text-sm font-bold">{itemCount}</span>
              Voir le panier
            </span>
            <span className="amount text-lg font-bold">{formatFCFA(total)}</span>
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
        allowCustomerCreate={allowCustomerCreate}
        defaults={initial?.checkout}
      />
    </>
  );
}

/**
 * Prix d'une ligne du panier : on le touche pour taper le prix négocié avec le client.
 * L'ancien prix reste affiché barré, avec un retour au prix habituel en un geste.
 */
function LinePrice({ product, price, onChange }: { product: PosProduct; price: number; onChange: (price: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number | "">(price);
  const negotiated = price !== product.salePrice;

  if (editing) {
    return (
      <form
        className="mt-1 flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          setEditing(false);
          if (value !== "") onChange(value);
        }}
      >
        <SuffixInput
          suffix={`FCFA / ${unitLabel(product.unit)}`}
          min={0}
          step={1}
          inputMode="numeric"
          autoFocus
          aria-label={`Prix négocié de ${product.name}`}
          className="h-9 pr-24 text-sm"
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setValue(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <Button type="submit" size="icon-sm" aria-label="Valider le prix">
          <Check />
        </Button>
      </form>
    );
  }

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <button
        type="button"
        onClick={() => {
          setValue(price);
          setEditing(true);
        }}
        className={cn(
          "num inline-flex items-center gap-1 rounded-md py-0.5 hover:text-foreground",
          negotiated ? "font-semibold text-primary" : "text-muted-foreground",
        )}
        aria-label={`Changer le prix de ${product.name}`}
      >
        {formatFCFA(price)} / {unitLabel(product.unit)} <Pencil className="size-3" />
      </button>
      {negotiated && (
        <>
          <span className="num text-muted-foreground line-through">{formatFCFA(product.salePrice)}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Prix habituel
          </button>
        </>
      )}
    </div>
  );
}

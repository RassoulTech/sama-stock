import { Package, PencilLine, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OnlinePos } from "@/components/offline/online-pos";
import type { PosInitial } from "@/components/pos/pos-screen";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { roundQty } from "@/lib/domain/stock";
import { SALE_METHODS, type SaleMethod } from "@/lib/domain/sales";
import { requireContext } from "@/server/context";
import { customerOptions } from "@/server/queries/customers";
import { listCategories, listProducts } from "@/server/queries/products";
import { getSale, type SaleDetail } from "@/server/queries/sales";

export const metadata: Metadata = { title: "Vendre" };

/** Pourquoi une vente ne peut pas être refaite à la caisse (le serveur refait les mêmes vérifications). */
function correctionProblem(sale: SaleDetail, locationId: string): string | null {
  if (sale.status !== "completed") return "Cette vente est déjà annulée.";
  if (sale.locationId !== locationId) return `Cette vente a été faite à ${sale.locationName} : passez sur cette boutique pour la corriger.`;
  if (sale.deliveryFee > 0) return "Cette vente a des frais de livraison : annulez-la, puis refaites-la depuis son devis.";
  return null;
}

export default async function VendrePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireContext("sales.create");
  if (!ctx.business.modulePos) redirect("/tableau-de-bord");
  if (ctx.plan.readOnly) redirect("/ventes");

  const correctId = (await searchParams).corriger;
  let sale: SaleDetail | null = null;
  if (typeof correctId === "string") {
    if (!ctx.can("sales.cancel")) redirect(`/ventes/${correctId}`);
    sale = await getSale(ctx, correctId);
    if (!sale || sale.kind !== "sale") notFound();
    const problem = correctionProblem(sale, ctx.location.id);
    if (problem) {
      return (
        <EmptyState
          icon={PencilLine}
          title="Impossible de corriger cette vente"
          description={problem}
          action={
            <Button asChild variant="outline">
              <Link href={`/ventes/${sale.id}`}>Retour à la vente</Link>
            </Button>
          }
        />
      );
    }
  }

  const [products, categories, customers] = await Promise.all([
    listProducts(ctx),
    listCategories(ctx.business.id),
    customerOptions(ctx.business.id),
  ]);

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Aucun produit à vendre"
        description="Ajoutez d'abord vos produits avec leur prix et leur stock."
        action={
          ctx.can("products.manage") && (
            <Button asChild>
              <Link href="/produits/nouveau">
                <Plus /> Ajouter un produit
              </Link>
            </Button>
          )
        }
      />
    );
  }

  // Correction : les quantités de l'ancienne vente reviennent en stock à la validation, elles sont donc disponibles
  const sold = new Map<string, { quantity: number; unitPrice: number }>();
  for (const i of sale?.items ?? []) {
    if (!i.productId) continue;
    const prev = sold.get(i.productId);
    sold.set(i.productId, { quantity: roundQty((prev?.quantity ?? 0) + i.quantity), unitPrice: prev?.unitPrice ?? i.unitPrice });
  }
  const sellable = new Set(products.map((p) => p.id));
  const missing = (sale?.items ?? []).filter((i) => !i.productId || !sellable.has(i.productId)).map((i) => i.name);
  const initial: PosInitial | undefined = sale
    ? {
        items: [...sold].filter(([id]) => sellable.has(id)).map(([productId, l]) => ({ productId, ...l })),
        discount: sale.discount,
        checkout: {
          paymentMethod: (SALE_METHODS as readonly string[]).includes(sale.paymentMethod ?? "") ? (sale.paymentMethod as SaleMethod) : "cash",
          customerId: sale.customer?.id ?? null,
          previousPaid: sale.amountPaid,
          previousTotal: sale.total,
          previousNumber: sale.number,
        },
      }
    : undefined;

  return (
    <OnlinePos
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        salePrice: p.salePrice,
        available: roundQty(p.available + (sold.get(p.id)?.quantity ?? 0)),
        imageUrl: p.imageUrl,
        categoryId: p.categoryId,
      }))}
      categories={categories.filter((c) => products.some((p) => p.categoryId === c.id))}
      customers={customers}
      business={{ name: ctx.business.name, logo: ctx.business.logo, address: ctx.business.address, city: ctx.business.city, phone: ctx.business.phone }}
      sellerName={ctx.user.name}
      correction={sale && initial ? { id: sale.id, initial } : undefined}
      banner={
        sale && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm text-accent-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="flex items-center gap-2 font-semibold">
                <PencilLine className="size-4" /> Correction de la vente {sale.number}
              </p>
              <p>Changez le panier, la remise ou le paiement, puis validez : l&apos;ancienne vente sera annulée et remplacée.</p>
              {missing.length > 0 && (
                <p className="font-medium text-warning dark:text-saffron">Plus en vente, retiré du panier : {missing.join(", ")}</p>
              )}
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={`/ventes/${sale.id}`}>Abandonner</Link>
            </Button>
          </div>
        )
      }
    />
  );
}

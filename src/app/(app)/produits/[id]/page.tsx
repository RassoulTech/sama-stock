import { ArrowDownToLine, ArrowUpFromLine, History, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveProductButton, DeleteProductButton } from "@/components/products/archive-product-button";
import { ProductThumb } from "@/components/products/product-thumb";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill, StockBadge } from "@/components/shared/stock-badge";
import { MovementCancelButton } from "@/components/stock/movement-cancel";
import { movementTypeLabel, reasonLabel, SignedQty } from "@/components/stock/movement-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatFCFA, formatQty, unitLabel, UNITS } from "@/lib/format";
import { cancellableMovement } from "@/lib/domain/stock";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { getProduct } from "@/server/queries/products";

export const metadata: Metadata = { title: "Produit" };

export default async function ProduitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext("products.view");
  const product = await getProduct(ctx, id);
  if (!product) notFound();

  const writable = !ctx.plan.readOnly;
  const canCancel = writable && ctx.can("stock.cancel");
  const unitName = UNITS.find((u) => u.id === product.unit)?.name ?? product.unit;
  const margin = product.costPrice !== null ? product.salePrice - product.costPrice : null;
  const current = product.current;

  return (
    <>
      <PageHeader
        backHref="/produits"
        title={
          <span className="flex items-center gap-3">
            {product.name}
            {product.archived && <StatusPill tone="gray">Archivé</StatusPill>}
          </span>
        }
        description={[product.categoryName, product.reference].filter(Boolean).join(" · ") || undefined}
        actions={
          writable && (
            <>
              {ctx.can("stock.in") && !product.archived && (
                <Button asChild variant="outline">
                  <Link href={`/stock/entree?produit=${product.id}`}>
                    <ArrowDownToLine /> Entrée
                  </Link>
                </Button>
              )}
              {ctx.can("stock.adjust") && !product.archived && (
                <Button asChild variant="outline">
                  <Link href={`/stock/sortie?produit=${product.id}`}>
                    <ArrowUpFromLine /> Sortie / perte
                  </Link>
                </Button>
              )}
              {ctx.can("products.manage") && (
                <>
                  <ArchiveProductButton id={product.id} archived={product.archived} />
                  {!product.hasHistory && <DeleteProductButton id={product.id} name={product.name} />}
                  <Button asChild>
                    <Link href={`/produits/${product.id}/modifier`}>
                      <Pencil /> Modifier
                    </Link>
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-3">
        <Card>
          <CardContent className="space-y-5">
            <ProductThumb
              name={product.name}
              imageUrl={product.imageUrl}
              className="aspect-[4/3] size-auto w-full rounded-xl text-4xl"
            />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Prix de vente</dt>
                <dd className="num text-lg font-semibold">{formatFCFA(product.salePrice)}</dd>
              </div>
              {product.costPrice !== null && (
                <div>
                  <dt className="text-muted-foreground">Prix d&apos;achat moyen</dt>
                  <dd className="num text-lg font-semibold">{formatFCFA(product.costPrice)}</dd>
                </div>
              )}
              {margin !== null && (
                <div className="col-span-2 rounded-xl bg-muted/60 p-3">
                  <dt className="text-muted-foreground">Marge par {unitLabel(product.unit)}</dt>
                  <dd className={`num text-lg font-semibold ${margin < 0 ? "text-destructive" : "text-success"}`}>
                    {formatFCFA(margin)}
                    {product.salePrice > 0 && (
                      <span className="ml-1 text-sm font-medium">({Math.round((margin / product.salePrice) * 100)} %)</span>
                    )}
                  </dd>
                  {margin < 0 && <p className="mt-1 text-xs text-destructive">Attention : ce produit est vendu à perte.</p>}
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Unité</dt>
                <dd className="font-medium">{unitName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Seuil d&apos;alerte</dt>
                <dd className="font-medium">{formatQty(product.alertThreshold, product.unit)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-5 xl:col-span-2">
          {current && (
            <Card>
              <CardContent>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Disponible · {current.locationName}</p>
                    <p className="num mt-1 text-4xl font-semibold tracking-tight">
                      {formatQty(current.available, product.unit)}
                    </p>
                  </div>
                  <StockBadge status={current.status} className="text-sm" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-muted-foreground">En rayon</p>
                    <p className="num font-semibold">{formatQty(current.physical, product.unit)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <p className="text-muted-foreground">Réservé (commandes)</p>
                    <p className="num font-semibold">{formatQty(current.reserved, product.unit)}</p>
                  </div>
                  {product.costPrice !== null && (
                    <div className="rounded-xl bg-muted/60 p-3">
                      <p className="text-muted-foreground">Valeur du stock</p>
                      <p className="num font-semibold">{formatFCFA(Math.max(0, current.physical) * product.costPrice)}</p>
                    </div>
                  )}
                </div>
                {product.perLocation.length > 1 && (
                  <div className="mt-5 space-y-2">
                    <p className="text-sm font-semibold">Par boutique / dépôt</p>
                    <ul className="divide-y rounded-xl border">
                      {product.perLocation.map((l) => (
                        <li key={l.locationId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                          <span className="font-medium">{l.locationName}</span>
                          <span className="flex items-center gap-3">
                            <span className="num">{formatQty(l.available, product.unit)}</span>
                            <StockBadge status={l.status} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <History className="size-4 text-primary" /> Derniers mouvements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {product.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun mouvement pour l&apos;instant.</p>
              ) : (
                <ul className="divide-y">
                  {product.movements.map((m) => {
                    const cancel = canCancel ? cancellableMovement(m) : null;
                    return (
                    <li key={m.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          <span className={cn(m.cancelled && "text-muted-foreground line-through")}>{movementTypeLabel(m.type)}</span>
                          {reasonLabel(m.reason) && (
                            <span className="font-normal text-muted-foreground"> · {reasonLabel(m.reason)}</span>
                          )}
                          {m.cancelled && (
                            <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Annulée</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(m.createdAt)} · {m.locationName}
                          {m.userName && <> · {m.userName}</>}
                        </p>
                        {m.note && <p className="mt-0.5 text-xs text-muted-foreground italic">{m.note}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <SignedQty quantity={m.quantity} unit={product.unit} className={cn(m.cancelled && "opacity-50 line-through")} />
                        {cancel && <MovementCancelButton kind={cancel} movementId={m.id} purchaseId={m.refId} productName={product.name} />}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

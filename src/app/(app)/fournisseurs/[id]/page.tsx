import { ArrowDownToLine, MessageCircle, Pencil, Phone, ShoppingBasket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatFCFA, formatPhone } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { requireContext } from "@/server/context";
import { getSupplier } from "@/server/queries/stock";
import { Pagination } from "@/components/shared/pagination";
import type { SearchParams } from "@/lib/filters";
import { pageSlice, readPage } from "@/lib/pagination";

export const metadata: Metadata = { title: "Fournisseur" };

export default async function FournisseurPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const query = await searchParams;
  const page = readPage(query);
  const ctx = await requireContext("suppliers.view");
  const data = await getSupplier(ctx, id, pageSlice(page));
  if (!data) notFound();
  const { supplier, purchases, purchaseCount } = data;
  const showCost = ctx.can("costs.view");
  const total = data.purchaseTotal;

  return (
    <>
      <PageHeader
        backHref="/fournisseurs"
        title={supplier.name}
        description={supplier.note ?? undefined}
        actions={
          <>
            {supplier.phone && (
              <>
                <Button asChild variant="outline">
                  <a href={`tel:${supplier.phone}`}>
                    <Phone /> Appeler
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={waLink(supplier.phone, "Bonjour,")} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> WhatsApp
                  </a>
                </Button>
              </>
            )}
            {ctx.can("suppliers.manage") && !ctx.plan.readOnly && (
              <SupplierDialog
                supplier={supplier}
                trigger={
                  <Button variant="outline">
                    <Pencil /> Modifier
                  </Button>
                }
              />
            )}
            {ctx.can("stock.in") && !ctx.plan.readOnly && (
              <Button asChild>
                <Link href="/stock/entree">
                  <ArrowDownToLine /> Nouvelle entrée
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">Téléphone</p>
            <p className="font-semibold">{supplier.phone ? formatPhone(supplier.phone) : "—"}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">Achats</p>
            <p className="num font-semibold">{purchaseCount}</p>
          </CardContent>
        </Card>
        {showCost && (
          <Card size="sm">
            <CardContent>
              <p className="text-sm text-muted-foreground">Total acheté</p>
              <p className="num font-semibold">{formatFCFA(total)}</p>
            </CardContent>
          </Card>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Historique des achats</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <EmptyState
              icon={ShoppingBasket}
              title="Aucun achat enregistré"
              description="Les entrées de stock liées à ce fournisseur apparaîtront ici."
            />
          ) : (
            <ul className="divide-y">
              {purchases.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(p.createdAt)} · {p.itemCount} produit{p.itemCount > 1 ? "s" : ""} · {p.locationName}
                      {p.userName && <> · {p.userName}</>}
                    </p>
                    {p.note && <p className="text-xs text-muted-foreground italic">{p.note}</p>}
                  </div>
                  {showCost && <span className="num font-semibold whitespace-nowrap">{formatFCFA(p.total)}</span>}
                </li>
              ))}
            </ul>
          )}
          <Pagination path={`/fournisseurs/${supplier.id}`} params={query} page={page} total={purchaseCount} />
        </CardContent>
      </Card>
    </>
  );
}

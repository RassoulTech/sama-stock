import { Lock, Package, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryDialog } from "@/components/products/category-dialog";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { NO_CATEGORY, presetRange } from "@/lib/filters";
import { formatFCFA } from "@/lib/format";
import { deleteCategory } from "@/server/actions/categories";
import { requireContext } from "@/server/context";
import { categoryBreakdown } from "@/server/queries/analytics";
import { categoryOverview } from "@/server/queries/categories";

export const metadata: Metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  const ctx = await requireContext("products.view");
  const canManage = ctx.can("products.manage") && !ctx.plan.readOnly;
  const showCost = ctx.can("costs.view");
  const showSales = ctx.plan.limits.advancedReports && ctx.can("reports.view");
  const month = presetRange("30j");

  const [{ categories, uncategorized }, sales] = await Promise.all([
    categoryOverview(ctx),
    showSales ? categoryBreakdown(ctx, month.from!, month.to) : Promise.resolve([]),
  ]);
  const salesById = new Map(sales.map((s) => [s.categoryId ?? NO_CATEGORY, s]));

  const addButton = canManage && (
    <CategoryDialog
      trigger={
        <Button>
          <Plus /> Nouvelle catégorie
        </Button>
      }
    />
  );

  const rows = [
    ...categories.map((c) => ({ key: c.id, id: c.id, name: c.name, productCount: c.productCount, stockValue: c.stockValue })),
    ...(uncategorized.productCount > 0
      ? [{ key: NO_CATEGORY, id: null, name: "Sans catégorie", ...uncategorized }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Catégories"
        description="Regroupez vos produits pour les retrouver vite et suivre les ventes de chaque famille."
        actions={addButton}
      />

      {!showSales && ctx.can("reports.view") && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border bg-accent/50 px-4 py-3 text-sm">
          <Lock className="size-4 shrink-0 text-primary" />
          <span className="flex-1">Les ventes par catégorie sont incluses dans les formules Pro et Business.</span>
          {ctx.can("billing.manage") && (
            <Button asChild size="sm" variant="outline">
              <Link href="/abonnement">Voir les formules</Link>
            </Button>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Aucune catégorie pour l'instant"
          description="Créez des catégories (Vêtements, Cosmétiques, Quincaillerie…) puis rangez-y vos produits."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => {
            const s = salesById.get(c.id ?? NO_CATEGORY);
            return (
              <li key={c.key} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <Link
                      href={`/produits?categorie=${c.id ?? NO_CATEGORY}`}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
                    >
                      <Package className="size-3.5" />
                      {c.productCount} produit{c.productCount > 1 ? "s" : ""}
                    </Link>
                  </div>
                  {canManage && c.id && (
                    <div className="flex shrink-0 gap-1">
                      <CategoryDialog
                        category={{ id: c.id, name: c.name }}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Renommer ${c.name}`}>
                            <Pencil />
                          </Button>
                        }
                      />
                      <ConfirmAction
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`Supprimer ${c.name}`}>
                            <Trash2 />
                          </Button>
                        }
                        title={`Supprimer « ${c.name} » ?`}
                        description={
                          c.productCount > 0
                            ? `Les ${c.productCount} produit(s) de cette catégorie sont conservés : ils passent simplement « sans catégorie ».`
                            : "Cette catégorie ne contient aucun produit."
                        }
                        confirmLabel="Supprimer"
                        destructive
                        successMessage="Catégorie supprimée"
                        action={deleteCategory.bind(null, c.id)}
                      />
                    </div>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                  {showCost && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Valeur du stock</dt>
                      <dd className="num font-semibold">{formatFCFA(c.stockValue)}</dd>
                    </div>
                  )}
                  {showSales && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Ventes sur 30 jours</dt>
                      <dd className="num font-semibold">
                        {formatFCFA(s?.revenue ?? 0)}
                        {s && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{s.share.toLocaleString("fr-FR")} %</span>}
                      </dd>
                    </div>
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      {showSales && rows.length > 0 && (
        <p className="mt-5 text-sm text-muted-foreground">
          Pour comparer les catégories sur une autre période, ouvrez les{" "}
          <Link href="/rapports" className="font-medium text-primary hover:underline">
            rapports
          </Link>
          .
        </p>
      )}
    </>
  );
}

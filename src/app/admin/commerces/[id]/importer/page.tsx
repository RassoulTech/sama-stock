import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductImport } from "@/components/products/product-import";
import { PageHeader } from "@/components/shared/page-header";
import { db } from "@/db";
import { businesses, products } from "@/db/schema";
import { computePlanState } from "@/lib/domain/plans";
import { normalizeText, productKey } from "@/lib/import/products";
import { adminImportProductsBatch } from "@/server/actions/licences";

export const metadata: Metadata = { title: "Importer les produits d'un client" };

/** Import Excel fait par l'administrateur pendant l'installation chez le client. */
export default async function AdminImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [b] = await db.select().from(businesses).where(eq(businesses.id, id));
  if (!b) notFound();
  const plan = computePlanState(b);
  const rows = await db
    .select({ name: products.name, reference: products.reference })
    .from(products)
    .where(and(eq(products.businessId, id), isNull(products.archivedAt)));

  return (
    <>
      <PageHeader
        backHref={`/admin/commerces/${id}`}
        title={`Importer les produits de ${b.name}`}
        description="Son fichier Excel ou CSV, même sans modèle : vérifiez l'aperçu, puis importez. Le stock va dans sa boutique principale."
      />
      <ProductImport
        existing={{
          names: rows.map((r) => productKey(r.name)),
          references: rows.filter((r) => r.reference).map((r) => normalizeText(r.reference)),
        }}
        productCount={rows.length}
        maxProducts={plan.limits.maxProducts}
        planLabel={plan.label}
        importBatch={adminImportProductsBatch.bind(null, id)}
      />
    </>
  );
}

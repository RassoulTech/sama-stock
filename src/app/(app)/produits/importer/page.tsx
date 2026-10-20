import { and, eq, isNull } from "drizzle-orm";
import { Check, FileSpreadsheet, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductImport } from "@/components/products/product-import";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { products } from "@/db/schema";
import { normalizeText, productKey } from "@/lib/import/products";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Importer des produits" };

export default async function ImporterPage() {
  const ctx = await requireContext("products.manage");

  if (!ctx.plan.limits.excel || ctx.plan.readOnly) {
    return (
      <>
        <PageHeader title="Importer des produits" backHref="/produits" />
        <Card className="mx-auto max-w-xl text-center">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <span className="grid size-14 place-items-center rounded-xl bg-accent text-primary">
              <Lock className="size-7" />
            </span>
            <h2 className="text-xl font-semibold">
              {ctx.plan.readOnly ? "Votre abonnement a expiré" : "L'import depuis Excel est inclus dans Pro et Business"}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Ajoutez tout votre catalogue d&apos;un coup depuis un fichier Excel ou CSV, même s&apos;il ne suit aucun modèle :
              Sama Stock reconnaît les colonnes, nettoie les prix et vous laisse vérifier avant d&apos;importer.
            </p>
            {ctx.can("billing.manage") && (
              <Button asChild size="lg">
                <Link href="/abonnement">Voir les formules</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  const rows = await db
    .select({ name: products.name, reference: products.reference })
    .from(products)
    .where(and(eq(products.businessId, ctx.business.id), isNull(products.archivedAt)));

  return (
    <>
      <PageHeader
        title="Importer des produits"
        description={`Depuis un fichier Excel ou CSV · stock ajouté à ${ctx.location.name}`}
        backHref="/produits"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <ProductImport
          existing={{
            names: rows.map((r) => productKey(r.name)),
            references: rows.filter((r) => r.reference).map((r) => normalizeText(r.reference)),
          }}
          productCount={rows.length}
          maxProducts={ctx.plan.limits.maxProducts}
          planLabel={ctx.plan.label}
        />
        <aside className="space-y-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <FileSpreadsheet className="size-4 text-primary" /> Comment ça marche
          </p>
          <ul className="space-y-2">
            {[
              "Votre fichier peut venir de n'importe où : seul le nom du produit est obligatoire.",
              "Les colonnes sont reconnues par leur titre, même avec une faute de frappe, ou devinées d'après leur contenu.",
              "Les tailles (« 3,5 litres »), montants calculés, anciens comptages et ventes passées sont écartés.",
              "« 15 000 FCFA », « 1500F », « 15.000 » ou « 2 cartons » sont lus correctement.",
              "Les titres de groupe (« BOISSONS ») deviennent des catégories ; celles qui n'existent pas sont créées.",
              "Pas de prix de vente ? Sama Stock peut le calculer à partir du prix d'achat.",
              "Vos corrections sont retenues pour le prochain fichier de même forme.",
              "Rien n'est enregistré avant que vous cliquiez sur « Importer ».",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

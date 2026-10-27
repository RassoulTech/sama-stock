import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/sales/print-button";
import { SignedQty } from "@/components/stock/movement-label";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { requireContext } from "@/server/context";
import { getInventory } from "@/server/queries/stock";

export const metadata: Metadata = { title: "Fiche d'inventaire" };

export default async function InventaireDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("stock.adjust");
  const { id } = await params;
  const inv = await getInventory(ctx, id);
  if (!inv) notFound();
  const showCost = ctx.can("costs.view");

  return (
    <>
      <PageHeader
        title={`Inventaire du ${formatDateTime(inv.createdAt)}`}
        description={`${inv.locationName}${inv.userName ? ` · compté par ${inv.userName}` : ""}`}
        backHref="/stock/inventaire?onglet=historique"
        actions={<PrintButton label="Imprimer" />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Produits comptés" value={String(inv.counted)} />
        <Stat label="Écarts" value={String(inv.gaps)} />
        {showCost && <Stat label="Valeur manquante" value={formatFCFA(inv.missingValue)} tone={inv.missingValue > 0 ? "danger" : undefined} />}
        {showCost && <Stat label="Valeur en trop" value={formatFCFA(inv.surplusValue)} />}
      </div>

      {inv.note && <p className="mb-4 rounded-xl border bg-card p-3 text-sm">Note : {inv.note}</p>}

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {inv.lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <p className="min-w-0 truncate font-medium">{l.productName}</p>
                <div className="text-right">
                  <SignedQty quantity={l.quantity} unit={l.unit} />
                  {showCost && l.quantity !== 0 && l.unitCost !== null && (
                    <p className="num text-xs text-muted-foreground">{formatFCFA(Math.round(l.quantity * l.unitCost))}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        « Conforme » : la quantité comptée était celle de l&apos;application. Les écarts ont corrigé le stock le jour de l&apos;inventaire.
      </p>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-xl font-semibold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

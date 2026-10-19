import { ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TransferForm } from "@/components/stock/transfer-form";
import { Button } from "@/components/ui/button";
import { requireContext } from "@/server/context";
import { toPicker } from "@/server/queries/picker";
import { listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Transfert" };

export default async function TransfertPage() {
  const ctx = await requireContext("stock.transfer");
  if (ctx.plan.readOnly) redirect("/stock");
  const destinations = ctx.locations.filter((l) => l.id !== ctx.location.id).map((l) => ({ id: l.id, name: l.name }));

  if (destinations.length === 0) {
    return (
      <>
        <PageHeader title="Transfert entre boutiques" backHref="/stock" />
        <EmptyState
          icon={ArrowLeftRight}
          title="Une seule boutique pour l'instant"
          description="Les transferts servent à déplacer du stock entre plusieurs boutiques ou dépôts (formule Business)."
          action={
            ctx.can("settings.manage") && (
              <Button asChild variant="outline">
                <Link href="/parametres">Gérer mes boutiques</Link>
              </Button>
            )
          }
        />
      </>
    );
  }

  const products = await listProducts(ctx);
  return (
    <>
      <PageHeader title="Transfert entre boutiques" backHref="/stock" />
      <TransferForm products={toPicker(products)} fromName={ctx.location.name} destinations={destinations} />
    </>
  );
}

import { ChevronRight, Phone, Plus, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";
import { Button } from "@/components/ui/button";
import { formatDate, formatFCFA, formatPhone } from "@/lib/format";
import { requireContext } from "@/server/context";
import { listSuppliers } from "@/server/queries/stock";

export const metadata: Metadata = { title: "Fournisseurs" };

export default async function FournisseursPage() {
  const ctx = await requireContext("suppliers.view");
  const suppliers = await listSuppliers(ctx.business.id);
  const canManage = ctx.can("suppliers.manage") && !ctx.plan.readOnly;
  const showCost = ctx.can("costs.view");

  const addButton = canManage && (
    <SupplierDialog
      trigger={
        <Button>
          <Plus /> Nouveau fournisseur
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title="Fournisseurs" description={`${suppliers.length} fournisseur(s)`} actions={addButton} />
      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Aucun fournisseur"
          description="Enregistrez vos fournisseurs pour savoir chez qui vous achetez et à quel prix."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((s) => (
            <li key={s.id}>
              <Link
                href={`/fournisseurs/${s.id}`}
                className="flex h-full items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.07] transition-colors hover:ring-primary/30"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <Truck className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  {s.phone && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="size-3.5" /> {formatPhone(s.phone)}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {s.purchaseCount} achat{s.purchaseCount > 1 ? "s" : ""}
                    {showCost && s.totalPurchased > 0 && <> · {formatFCFA(s.totalPurchased)}</>}
                    {s.lastPurchaseAt && <> · dernier le {formatDate(s.lastPurchaseAt)}</>}
                  </p>
                </div>
                <ChevronRight className="size-4 self-center text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

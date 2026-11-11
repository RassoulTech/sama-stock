import { HandCoins, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { CustomerList } from "@/components/customers/customer-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listCustomers } from "@/server/queries/customers";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const ctx = await requireContext("customers.manage");
  const customers = await listCustomers(ctx.business.id);
  const totalDebt = customers.reduce((s, c) => s + c.debt, 0);
  const debtors = customers.filter((c) => c.debt > 0).length;

  const addButton = !ctx.plan.readOnly && (
    <CustomerDialog
      pilote
      trigger={
        <Button data-assistant="client.nouveau">
          <Plus /> Nouveau client
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Clients et crédits"
        description={`${customers.length} client${customers.length > 1 ? "s" : ""}`}
        actions={addButton}
      />
      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun client pour l'instant"
          description="Ajoutez vos clients pour suivre leurs achats, leurs dettes et leur envoyer des reçus sur WhatsApp."
          action={addButton}
        />
      ) : (
        <>
          {/* Ce que les clients doivent, en une carte aux couleurs de la boutique */}
          <section
            aria-label="Crédits clients"
            className="relative mb-6 overflow-hidden rounded-[1.75rem] p-5 text-primary-foreground shadow-[0_22px_44px_-24px_var(--sidebar)] sm:max-w-xl"
            style={{ backgroundImage: "linear-gradient(150deg, var(--sidebar) 0%, color-mix(in oklab, var(--sidebar) 70%, black) 100%)" }}
          >
            <div aria-hidden className="absolute -top-20 -right-12 size-52 rounded-full bg-white/[0.07]" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium opacity-80">Total à encaisser</p>
                <p className="amount mt-1 text-[2rem] leading-none font-bold">{formatFCFA(totalDebt)}</p>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12">
                <HandCoins className="size-5" />
              </span>
            </div>
            <div className="relative mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10">
              <div className="bg-white/[0.04] px-3 py-3">
                <p className="text-xs opacity-75">Doivent de l&apos;argent</p>
                <p className={cn("amount mt-0.5 text-xl font-bold", debtors > 0 && "text-saffron")}>{debtors}</p>
              </div>
              <div className="bg-white/[0.04] px-3 py-3">
                <p className="text-xs opacity-75">Clients enregistrés</p>
                <p className="amount mt-0.5 text-xl font-bold">{customers.length}</p>
              </div>
            </div>
          </section>
          <CustomerList customers={customers} />
        </>
      )}
    </>
  );
}

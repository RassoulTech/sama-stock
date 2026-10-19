import { HandCoins, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { CustomerList } from "@/components/customers/customer-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
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
      trigger={
        <Button>
          <Plus /> Nouveau client
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title="Clients et crédits" description={`${customers.length} client(s)`} actions={addButton} />
      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun client pour l'instant"
          description="Ajoutez vos clients pour suivre leurs achats, leurs dettes et leur envoyer des reçus sur WhatsApp."
          action={addButton}
        />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Total à encaisser"
              value={formatFCFA(totalDebt)}
              icon={HandCoins}
              tone={totalDebt > 0 ? "danger" : "primary"}
              hint={`${debtors} client${debtors > 1 ? "s" : ""} avec une dette`}
            />
            <StatCard label="Clients enregistrés" value={customers.length} icon={Users} tone="neutral" />
          </div>
          <CustomerList customers={customers} />
        </>
      )}
    </>
  );
}

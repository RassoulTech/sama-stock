import { AlertTriangle, Ban, Clock, Store, Users } from "lucide-react";
import type { Metadata } from "next";
import { BusinessTable } from "@/components/admin/business-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { adminStats, listAllBusinesses } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Commerces" };

export default async function AdminBusinessesPage() {
  const rows = await listAllBusinesses();
  const stats = adminStats(rows);

  return (
    <>
      <PageHeader title="Commerces" description="Tous les commerces inscrits, leur formule et leur activité." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Commerces" value={stats.total} icon={Store} tone="neutral" />
        <StatCard label="En essai" value={stats.trialing} icon={Clock} tone="neutral" />
        <StatCard label="Payants" value={stats.active} icon={Users} />
        <StatCard label="Expirés" value={stats.expired} icon={AlertTriangle} tone="saffron" />
        <StatCard label="Suspendus" value={stats.suspended} icon={Ban} tone="danger" />
      </div>
      <BusinessTable
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          ownerName: r.ownerName,
          ownerEmail: r.ownerEmail,
          phone: r.phone,
          city: r.city,
          planLabel: r.state.label,
          status: r.state.status,
          endsAt: r.state.endsAt?.toISOString() ?? null,
          productCount: r.productCount,
          memberCount: r.memberCount,
          sales30: r.sales30,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

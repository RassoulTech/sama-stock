import { Download } from "lucide-react";
import type { Metadata } from "next";
import { BusinessTable } from "@/components/admin/business-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { HEALTH_LABELS, type BusinessHealth } from "@/lib/domain/admin";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/domain/plans";
import { adminStats, listAllBusinesses } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Commerces" };

type Params = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function AdminBusinessesPage({ searchParams }: { searchParams: Params }) {
  const [rows, params] = await Promise.all([listAllBusinesses(), searchParams]);
  const stats = adminStats(rows);
  const statut = one(params.statut);
  const activite = one(params.activite);

  return (
    <>
      <PageHeader
        title="Commerces"
        description={`${stats.total} commerce${stats.total > 1 ? "s" : ""} · ${stats.active} payant${stats.active > 1 ? "s" : ""} · ${stats.trialing} en essai · ${stats.alive7} en activité cette semaine`}
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/export/commerces" download>
              <Download /> Exporter (Excel)
            </a>
          </Button>
        }
      />
      <BusinessTable
        initial={{
          q: one(params.q),
          status: statut && statut in PLAN_STATUS_LABELS ? (statut as PlanStatus) : undefined,
          health: activite && activite in HEALTH_LABELS ? (activite as BusinessHealth) : undefined,
          plan: one(params.formule) === "licence" ? "licence" : undefined,
        }}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          ownerName: r.ownerName,
          ownerEmail: r.ownerEmail,
          phone: r.phone,
          city: r.city,
          plan: r.state.plan,
          license: Boolean(r.state.license),
          planLabel: r.state.label,
          status: r.state.status,
          health: r.health,
          endsAt: r.state.endsAt?.toISOString() ?? null,
          daysLeft: r.state.daysLeft,
          productCount: r.productCount,
          memberCount: r.memberCount,
          sales30: r.sales30,
          revenue30: r.revenue30,
          lastActivity: r.lastActivity?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

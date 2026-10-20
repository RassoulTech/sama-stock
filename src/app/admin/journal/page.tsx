import type { Metadata } from "next";
import { AuditFeed } from "@/components/admin/audit-feed";
import { PageHeader } from "@/components/shared/page-header";
import { listAudit } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Journal des actions" };

export default async function AdminAuditPage() {
  const entries = await listAudit({ limit: 500 });
  return (
    <>
      <PageHeader
        title="Journal des actions"
        description="Tout ce que les administrateurs ont fait : changements de formule, paiements en espèces, suspensions, déconnexions, notes."
      />
      <AuditFeed entries={entries.map((e) => ({ ...e, created_at: new Date(e.created_at).toISOString() }))} />
    </>
  );
}

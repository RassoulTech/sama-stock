import { Monitor, MonitorSmartphone, Smartphone, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { SessionsTable } from "@/components/admin/sessions-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { describeDevice } from "@/lib/user-agent";
import { getSession } from "@/server/context";
import { listSessions } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Connexions" };

export default async function AdminSessionsPage() {
  const [current, sessions] = await Promise.all([getSession(), listSessions()]);
  const rows = sessions.map((s) => {
    const d = describeDevice(s.user_agent);
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      device: `${d.browser} · ${d.os}`,
      mobile: d.mobile,
      ip: s.ip_address,
      createdAt: new Date(s.created_at).toISOString(),
      lastSeen: new Date(s.last_seen).toISOString(),
      expiresAt: new Date(s.expires_at).toISOString(),
      isCurrent: s.id === current?.session.id,
    };
  });
  const people = new Set(sessions.map((s) => s.user_id)).size;
  const mobile = rows.filter((r) => r.mobile).length;

  return (
    <>
      <PageHeader
        title="Connexions"
        description="Les sessions ouvertes en ce moment. Déconnectez un appareil perdu ou une activité suspecte."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sessions ouvertes" value={rows.length} icon={MonitorSmartphone} />
        <StatCard label="Personnes connectées" value={people} icon={UserRound} tone="neutral" />
        <StatCard label="Sur téléphone" value={mobile} icon={Smartphone} tone="neutral" />
        <StatCard label="Sur ordinateur" value={rows.length - mobile} icon={Monitor} tone="neutral" />
      </div>
      <SessionsTable rows={rows} />
    </>
  );
}

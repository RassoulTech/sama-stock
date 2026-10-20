import { Activity, Download, LogIn, UserRound, UserX } from "lucide-react";
import type { Metadata } from "next";
import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AdminStat } from "@/components/admin/admin-stat";
import { isSuperAdminEmail, requireSuperAdmin } from "@/server/context";
import { listAllUsers } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [ctx, users, params] = await Promise.all([requireSuperAdmin(), listAllUsers(), searchParams]);
  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: new Date(u.created_at).toISOString(),
    lastSeen: u.last_seen ? new Date(u.last_seen).toISOString() : null,
    activeSessions: u.active_sessions,
    providers: u.providers ?? [],
    isAdmin: isSuperAdminEmail(u.email),
    isCurrent: u.id === ctx.user.id,
    memberships: u.memberships ?? [],
  }));
  const google = rows.filter((r) => r.providers.includes("google")).length;
  const orphans = rows.filter((r) => r.memberships.length === 0).length;
  const online = rows.filter((r) => r.activeSessions > 0).length;

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Tous les comptes : mode de connexion, commerces, rôle et dernière activité."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/export/utilisateurs" download>
              <Download /> Exporter (Excel)
            </a>
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <AdminStat index={0} label="Comptes" value={rows.length} icon={UserRound} tone="blue" />
        <AdminStat index={1} label="Avec Google" value={google} icon={LogIn} tone="blue" />
        <AdminStat index={2} label="Sans commerce" value={orphans} hint="Inscription non terminée" icon={UserX} tone="saffron" />
        <AdminStat index={3} label="Connectés" value={online} hint="Au moins une session ouverte" icon={Activity} />
      </div>
      <UsersTable rows={rows} initialQuery={typeof params.q === "string" ? params.q : ""} />
    </>
  );
}

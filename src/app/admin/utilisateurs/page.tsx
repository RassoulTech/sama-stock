import { Activity, LogIn, UserRound, UserX } from "lucide-react";
import type { Metadata } from "next";
import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { isSuperAdminEmail, requireSuperAdmin } from "@/server/context";
import { listAllUsers } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function AdminUsersPage() {
  const [ctx, users] = await Promise.all([requireSuperAdmin(), listAllUsers()]);
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
      <PageHeader title="Utilisateurs" description="Tous les comptes : mode de connexion, commerces, rôle et dernière activité." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Comptes" value={rows.length} icon={UserRound} />
        <StatCard label="Avec Google" value={google} icon={LogIn} tone="neutral" />
        <StatCard label="Sans commerce" value={orphans} hint="Inscription non terminée" icon={UserX} tone="saffron" />
        <StatCard label="Connectés" value={online} hint="Au moins une session ouverte" icon={Activity} tone="neutral" />
      </div>
      <UsersTable rows={rows} />
    </>
  );
}

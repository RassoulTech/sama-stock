"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GoogleIcon } from "@/components/brand/google-icon";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { FilterChips } from "@/components/shared/filter-chips";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { isRole, ROLE_LABELS } from "@/lib/domain/permissions";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { adminRevokeUserSessions } from "@/server/actions/admin";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastSeen: string | null;
  activeSessions: number;
  providers: string[];
  isAdmin: boolean;
  isCurrent: boolean;
  memberships: { businessId: string; business: string; role: string }[];
}

type Filter = "all" | "google" | "email" | "orphan" | "admin";

export function UsersTable({ rows }: { rows: AdminUserRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const test: Record<Filter, (r: AdminUserRow) => boolean> = {
    all: () => true,
    google: (r) => r.providers.includes("google"),
    email: (r) => r.providers.includes("credential"),
    orphan: (r) => r.memberships.length === 0,
    admin: (r) => r.isAdmin,
  };
  const filtered = rows.filter(
    (r) => test[filter](r) && matchesSearch(q, r.name, r.email, ...r.memberships.map((m) => m.business)),
  );

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} placeholder="Nom, email ou commerce…" />
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Tous", count: rows.length },
          { value: "google", label: "Connexion Google", count: rows.filter(test.google).length },
          { value: "email", label: "Email et mot de passe", count: rows.filter(test.email).length },
          { value: "orphan", label: "Sans commerce", count: rows.filter(test.orphan).length },
          { value: "admin", label: "Administrateurs", count: rows.filter(test.admin).length },
        ]}
      />
      {filtered.length === 0 ? (
        <p className="surface p-6 text-center text-sm text-muted-foreground">Aucun utilisateur ne correspond.</p>
      ) : (
        <ul className="surface divide-y">
          {filtered.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-primary">
                {initials(u.name || u.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {u.name || "Sans nom"}
                  {u.isAdmin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      <ShieldCheck className="size-3" /> Admin
                    </span>
                  )}
                  {u.providers.includes("google") && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
                      <GoogleIcon className="size-3" /> Google
                    </span>
                  )}
                  {u.providers.includes("credential") && (
                    <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">Email</span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {u.memberships.length === 0 ? (
                    <span>Aucun commerce</span>
                  ) : (
                    u.memberships.map((m) => (
                      <Link key={m.businessId} href={`/admin/commerces/${m.businessId}`} className="hover:text-foreground hover:underline">
                        {m.business} · {isRole(m.role) ? ROLE_LABELS[m.role] : m.role}
                      </Link>
                    ))
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground sm:text-right">
                <span>
                  Inscrit le {formatDate(u.createdAt)}
                  <span className="block">
                    {u.lastSeen ? `Vu le ${formatDateTime(u.lastSeen)}` : "Aucune session en cours"}
                    {u.activeSessions > 0 && ` · ${u.activeSessions} session${u.activeSessions > 1 ? "s" : ""}`}
                  </span>
                </span>
                {u.activeSessions > 0 && !u.isCurrent && (
                  <ConfirmAction
                    trigger={
                      <Button variant="outline" size="sm" aria-label={`Déconnecter ${u.email} de tous ses appareils`}>
                        <LogOut />
                      </Button>
                    }
                    title={`Déconnecter ${u.name || u.email} ?`}
                    description="Toutes ses sessions sont fermées : il devra se reconnecter sur chacun de ses appareils. Son compte et ses données ne changent pas."
                    confirmLabel="Déconnecter partout"
                    destructive
                    successMessage="Utilisateur déconnecté de tous ses appareils"
                    action={() => adminRevokeUserSessions(u.id)}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

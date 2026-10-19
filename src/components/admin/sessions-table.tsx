"use client";

import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { adminRevokeSession } from "@/server/actions/admin";

export interface AdminSessionRow {
  id: string;
  name: string;
  email: string;
  device: string;
  mobile: boolean;
  ip: string | null;
  createdAt: string;
  lastSeen: string;
  expiresAt: string;
  isCurrent: boolean;
}

export function SessionsTable({ rows }: { rows: AdminSessionRow[] }) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) => matchesSearch(q, r.name, r.email, r.device, r.ip));

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} placeholder="Utilisateur, appareil ou adresse IP…" />
      {filtered.length === 0 ? (
        <p className="surface p-6 text-center text-sm text-muted-foreground">Aucune session active.</p>
      ) : (
        <ul className="surface divide-y">
          {filtered.map((s) => {
            const DeviceIcon = s.mobile ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <DeviceIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {s.name || s.email}
                    {s.isCurrent && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">Cette session</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {s.device}
                    {s.ip && <> · IP {s.ip}</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground sm:text-right">
                  <span>
                    Active le {formatDateTime(s.lastSeen)}
                    <span className="block">
                      Ouverte le {formatDateTime(s.createdAt)} · expire le {formatDateTime(s.expiresAt)}
                    </span>
                  </span>
                  {!s.isCurrent && (
                    <ConfirmAction
                      trigger={
                        <Button variant="outline" size="sm" aria-label={`Déconnecter cette session de ${s.email}`}>
                          <LogOut />
                        </Button>
                      }
                      title="Déconnecter cette session ?"
                      description={`${s.name || s.email} sera déconnecté de cet appareil (${s.device}). Utile en cas de téléphone perdu ou d'activité suspecte.`}
                      confirmLabel="Déconnecter"
                      destructive
                      successMessage="Session fermée"
                      action={() => adminRevokeSession(s.id)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

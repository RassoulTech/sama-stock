"use client";

import { useState } from "react";
import { ClientPagination, usePaged } from "@/components/shared/client-pagination";
import { FilterChips } from "@/components/shared/filter-chips";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { ADMIN_ACTIONS, type AdminAction } from "@/lib/domain/admin";
import { AuditList, type AuditEntry } from "./audit-list";

/** Groupes de filtres du journal (plusieurs actions proches par groupe). */
const GROUPS: Record<string, { label: string; actions: AdminAction[] }> = {
  licence: { label: "Licences", actions: ["license", "license_payment", "maintenance", "license_cancel", "brand", "import", "reset_password"] },
  abonnement: { label: "Abonnements", actions: ["plan", "extend", "expire"] },
  paiement: { label: "Paiements", actions: ["cash", "license_payment", "maintenance"] },
  acces: { label: "Suspensions", actions: ["suspend", "resume"] },
  securite: { label: "Connexions", actions: ["revoke_session", "revoke_user"] },
  note: { label: "Notes", actions: ["note"] },
};

export function AuditFeed({ entries }: { entries: AuditEntry[] }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const inGroup = (e: AuditEntry) => group === "all" || GROUPS[group]!.actions.includes(e.action as AdminAction);
  const filtered = entries.filter(
    (e) => inGroup(e) && matchesSearch(q, e.summary, e.business, e.actor_email, e.target_email, ADMIN_ACTIONS[e.action as AdminAction]),
  );
  const { setTop, ...pager } = usePaged(filtered, `${q}|${group}`);

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} placeholder="Commerce, administrateur, action…" />
      <FilterChips
        value={group}
        onChange={setGroup}
        options={[
          { value: "all", label: "Tout", count: entries.length },
          ...Object.entries(GROUPS).map(([value, g]) => ({
            value,
            label: g.label,
            count: entries.filter((e) => g.actions.includes(e.action as AdminAction)).length,
          })),
        ]}
      />
      <div ref={setTop} className="scroll-mt-20 rounded-xl border bg-card p-4 sm:p-5">
        <AuditList entries={pager.items} />
      </div>
      <ClientPagination pager={pager} />
    </div>
  );
}

"use client";

import { ChevronRight, Store } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterChips } from "@/components/shared/filter-chips";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { StatusPill } from "@/components/shared/stock-badge";
import { formatDate } from "@/lib/format";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES, type PlanStatus } from "@/lib/domain/plans";

export interface AdminRow {
  id: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  phone: string | null;
  city: string | null;
  planLabel: string;
  status: PlanStatus;
  endsAt: string | null;
  productCount: number;
  memberCount: number;
  sales30: number;
  createdAt: string;
}

export function BusinessTable({ rows }: { rows: AdminRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | PlanStatus>("all");
  const filtered = rows.filter(
    (r) => matchesSearch(q, r.name, r.ownerName, r.ownerEmail, r.phone, r.city) && (status === "all" || r.status === status),
  );

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} placeholder="Commerce, propriétaire, email, téléphone…" />
      <FilterChips
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "Tous", count: rows.length },
          ...(["trialing", "active", "expired", "suspended"] as PlanStatus[]).map((s) => ({
            value: s,
            label: PLAN_STATUS_LABELS[s],
            count: rows.filter((r) => r.status === s).length,
          })),
        ]}
      />
      {filtered.length === 0 ? (
        <EmptyState icon={Store} title="Aucun commerce" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.07]">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/commerces/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.name}
                    <StatusPill tone={PLAN_STATUS_TONES[r.status]}>
                      {r.planLabel} · {PLAN_STATUS_LABELS[r.status]}
                    </StatusPill>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.ownerName} · {r.ownerEmail}
                    {r.city && <> · {r.city}</>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.productCount} produits · {r.memberCount} membre{r.memberCount > 1 ? "s" : ""} · {r.sales30} ventes (30 j) ·
                    inscrit le {formatDate(r.createdAt)}
                    {r.endsAt && <> · fin le {formatDate(r.endsAt)}</>}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

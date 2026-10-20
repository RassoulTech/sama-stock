"use client";

import { ArrowDownUp, ChevronRight, RotateCcw, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterChips } from "@/components/shared/filter-chips";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HEALTH_LABELS, planBadgeText, type BusinessHealth } from "@/lib/domain/admin";
import { PLAN_STATUS_LABELS, PLAN_STATUS_TONES, type PlanId, type PlanStatus } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HealthPill, relativeDay } from "./contact-buttons";

export interface AdminRow {
  id: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  phone: string | null;
  city: string | null;
  plan: PlanId;
  planLabel: string;
  status: PlanStatus;
  health: BusinessHealth;
  endsAt: string | null;
  daysLeft: number;
  productCount: number;
  memberCount: number;
  sales30: number;
  revenue30: number;
  lastActivity: string | null;
  createdAt: string;
}

type Sort = "recent" | "name" | "activity" | "sales" | "end";
const SORTS: Record<Sort, string> = {
  recent: "Plus récents",
  name: "Nom (A → Z)",
  activity: "Dernière activité",
  sales: "Montant vendu (30 j)",
  end: "Fin de période la plus proche",
};

const time = (d: string | null) => (d ? new Date(d).getTime() : 0);

export function BusinessTable({
  rows,
  initial,
}: {
  rows: AdminRow[];
  initial: { q?: string; status?: "all" | PlanStatus; plan?: "all" | PlanId; health?: "all" | BusinessHealth };
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q ?? "");
  const [status, setStatus] = useState<"all" | PlanStatus>(initial.status ?? "all");
  const [plan, setPlan] = useState<"all" | PlanId>(initial.plan ?? "all");
  const [health, setHealth] = useState<"all" | BusinessHealth>(initial.health ?? "all");
  const [sort, setSort] = useState<Sort>("recent");
  const active = q !== "" || status !== "all" || plan !== "all" || health !== "all" || sort !== "recent";

  const filtered = rows
    .filter(
      (r) =>
        matchesSearch(q, r.name, r.ownerName, r.ownerEmail, r.phone, r.city) &&
        (status === "all" || r.status === status) &&
        (plan === "all" || r.plan === plan) &&
        (health === "all" || r.health === health),
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "fr");
      if (sort === "activity") return time(b.lastActivity) - time(a.lastActivity);
      if (sort === "sales") return b.revenue30 - a.revenue30;
      if (sort === "end") return (time(a.endsAt) || Infinity) - (time(b.endsAt) || Infinity);
      return time(b.createdAt) - time(a.createdAt);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder="Nom, propriétaire, e-mail, ville…" className="flex-1" />
        {/* Téléphone : formule et activité côte à côte, tri sur toute la largeur */}
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <Select value={plan} onValueChange={(v) => setPlan(v as typeof plan)}>
            <SelectTrigger className="w-full lg:w-40" aria-label="Formule">
              <SelectValue>{plan === "all" ? "Formule" : { trial: "Essai", pro: "Pro", business: "Business" }[plan]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les formules</SelectItem>
              <SelectItem value="trial">Essai</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
          <Select value={health} onValueChange={(v) => setHealth(v as typeof health)}>
            <SelectTrigger className="w-full lg:w-44" aria-label="Activité">
              <SelectValue>{health === "all" ? "Activité" : HEALTH_LABELS[health]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute activité</SelectItem>
              {(Object.keys(HEALTH_LABELS) as BusinessHealth[]).map((h) => (
                <SelectItem key={h} value={h}>
                  {HEALTH_LABELS[h]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="col-span-2 w-full lg:w-56" aria-label="Trier">
              <ArrowDownUp className="size-3.5 opacity-60" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(SORTS) as [Sort, string][]).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterChips
          value={status}
          onChange={setStatus}
          className="min-w-0 flex-1"
          options={[
            { value: "all", label: "Tous", count: rows.length },
            ...(["trialing", "active", "expired", "suspended"] as PlanStatus[]).map((s) => ({
              value: s,
              label: PLAN_STATUS_LABELS[s],
              count: rows.filter((r) => r.status === s).length,
            })),
          ]}
        />
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {filtered.length} commerce{filtered.length > 1 ? "s" : ""}
        </span>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setStatus("all");
              setPlan("all");
              setHealth("all");
              setSort("recent");
            }}
          >
            <RotateCcw /> Réinitialiser
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Store} title="Aucun commerce" description="Essayez un autre mot ou retirez les filtres." />
      ) : (
        <>
          {/* Téléphone : cartes */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/commerces/${r.id}`} className="block rounded-xl border bg-card p-3.5 active:bg-muted">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[r.ownerName, r.city].filter(Boolean).join(" · ") || r.ownerEmail}
                      </span>
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusPill tone={PLAN_STATUS_TONES[r.status]}>
                      {planBadgeText(r.planLabel, r.status, PLAN_STATUS_LABELS[r.status])}
                    </StatusPill>
                    <HealthPill health={r.health} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-2.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Produits</dt>
                      <dd className="num font-semibold">{r.productCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Vendu (30 j)</dt>
                      <dd className="num font-semibold">{formatFCFA(r.revenue30)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Fin</dt>
                      <dd className={cn("num font-semibold", r.daysLeft <= 3 && r.endsAt && "text-warning dark:text-saffron")}>
                        {r.endsAt ? formatDate(r.endsAt) : "—"}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          {/* Ordinateur : tableau */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Commerce</th>
                  <th className="px-3 py-2.5 font-medium">Formule</th>
                  <th className="px-3 py-2.5 font-medium">Activité</th>
                  <th className="px-3 py-2.5 text-right font-medium">Produits</th>
                  <th className="px-3 py-2.5 text-right font-medium">Vendu (30 j)</th>
                  <th className="px-3 py-2.5 font-medium">Fin de période</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => router.push(`/admin/commerces/${r.id}`)}
                  >
                    <td className="max-w-72 px-4 py-3">
                      <Link href={`/admin/commerces/${r.id}`} className="block truncate font-semibold group-hover:text-primary" onClick={(e) => e.stopPropagation()}>
                        {r.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.ownerName ?? "—"} · {r.ownerEmail ?? "—"}
                        {r.city && <> · {r.city}</>}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill tone={PLAN_STATUS_TONES[r.status]}>
                        {planBadgeText(r.planLabel, r.status, PLAN_STATUS_LABELS[r.status])}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-3">
                      <HealthPill health={r.health} />
                      <span className="mt-0.5 block text-xs text-muted-foreground">{relativeDay(r.lastActivity)}</span>
                    </td>
                    <td className="num px-3 py-3 text-right">{r.productCount}</td>
                    <td className="num px-3 py-3 text-right">
                      <span className="font-semibold">{formatFCFA(r.revenue30)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.sales30} vente{r.sales30 > 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {r.endsAt ? (
                        <>
                          <span className="num block font-medium">{formatDate(r.endsAt)}</span>
                          <span className={cn("text-muted-foreground", r.daysLeft <= 3 && r.status !== "expired" && "font-semibold text-warning dark:text-saffron")}>
                            {r.status === "expired" ? "terminé" : `${r.daysLeft} j restant${r.daysLeft > 1 ? "s" : ""}`}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="pr-3">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

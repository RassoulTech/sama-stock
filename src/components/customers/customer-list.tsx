"use client";

import { ChevronRight, UserSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterChips } from "@/components/shared/filter-chips";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, formatFCFA, formatPhone, initials } from "@/lib/format";
import type { CustomerRow } from "@/server/queries/customers";

type Sort = "debt" | "name" | "recent";

export function CustomerList({ customers }: { customers: CustomerRow[] }) {
  const [q, setQ] = useState("");
  const hasDebtors = customers.some((c) => c.debt > 0);
  const [sort, setSort] = useState<Sort>(hasDebtors ? "debt" : "name");

  const rows = customers
    .filter((c) => matchesSearch(q, c.name, c.phone))
    .filter((c) => sort !== "debt" || c.debt > 0)
    .sort((a, b) => {
      if (sort === "debt") return b.debt - a.debt;
      if (sort === "recent") return (b.lastPurchaseAt ? +new Date(b.lastPurchaseAt) : 0) - (a.lastPurchaseAt ? +new Date(a.lastPurchaseAt) : 0);
      return a.name.localeCompare(b.name, "fr");
    });

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} placeholder="Nom ou téléphone…" />
      <FilterChips
        value={sort}
        onChange={setSort}
        options={[
          { value: "debt", label: "Doivent de l'argent", count: customers.filter((c) => c.debt > 0).length },
          { value: "recent", label: "Récents" },
          { value: "name", label: "A → Z" },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title={sort === "debt" && !q ? "Aucune dette en cours" : "Aucun client trouvé"}
          description={sort === "debt" && !q ? "Tous vos clients sont à jour. Bravo !" : undefined}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-card border">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <Avatar className="size-11">
                  <AvatarFallback className="bg-accent font-semibold text-accent-foreground">{initials(c.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.phone ? formatPhone(c.phone) : "Pas de téléphone"}
                    {c.lastPurchaseAt && <> · dernier achat le {formatDate(c.lastPurchaseAt)}</>}
                  </p>
                </div>
                {c.debt > 0 ? (
                  <div className="text-right">
                    <p className="num font-semibold text-destructive">{formatFCFA(c.debt)}</p>
                    <p className="text-xs text-muted-foreground">à payer</p>
                  </div>
                ) : (
                  <span className="num hidden text-sm text-muted-foreground sm:inline">{formatFCFA(c.spent)} achetés</span>
                )}
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

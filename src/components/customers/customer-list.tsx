"use client";

import { ChevronRight, RotateCcw, UserSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ClientPagination, usePaged } from "@/components/shared/client-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterChips } from "@/components/shared/filter-chips";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatFCFA, formatPhone, initials } from "@/lib/format";
import type { CustomerRow } from "@/server/queries/customers";

type Filter = "all" | "debt" | "clear" | "inactive";
type Sort = "debt" | "recent" | "name" | "spent";

const SORTS: Record<Sort, string> = {
  debt: "Trier : plus grosse dette",
  recent: "Trier : achat le plus récent",
  spent: "Trier : meilleurs clients",
  name: "Trier : nom (A → Z)",
};

const INACTIVE_DAYS = 30;

export function CustomerList({ customers }: { customers: CustomerRow[] }) {
  const hasDebtors = customers.some((c) => c.debt > 0);
  const defaults = { filter: (hasDebtors ? "debt" : "all") as Filter, sort: (hasDebtors ? "debt" : "name") as Sort };
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>(defaults.filter);
  const [sort, setSort] = useState<Sort>(defaults.sort);
  const [now] = useState(() => Date.now());
  const inactive = (c: CustomerRow) => !c.lastPurchaseAt || now - new Date(c.lastPurchaseAt).getTime() > INACTIVE_DAYS * 86_400_000;

  const counts = {
    all: customers.length,
    debt: customers.filter((c) => c.debt > 0).length,
    clear: customers.filter((c) => c.debt <= 0).length,
    inactive: customers.filter(inactive).length,
  };

  const rows = customers
    .filter((c) => matchesSearch(q, c.name, c.phone, c.address))
    .filter((c) => filter === "all" || (filter === "debt" ? c.debt > 0 : filter === "clear" ? c.debt <= 0 : inactive(c)))
    .sort((a, b) => {
      if (sort === "debt") return b.debt - a.debt || a.name.localeCompare(b.name, "fr");
      if (sort === "spent") return b.spent - a.spent;
      if (sort === "recent") return (b.lastPurchaseAt ? +new Date(b.lastPurchaseAt) : 0) - (a.lastPurchaseAt ? +new Date(a.lastPurchaseAt) : 0);
      return a.name.localeCompare(b.name, "fr");
    });
  const { setTop, ...pager } = usePaged(rows, `${q}|${filter}|${sort}`);

  const active = q !== "" || filter !== defaults.filter || sort !== defaults.sort;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder="Nom, téléphone ou quartier…" className="flex-1" />
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="h-11 w-full bg-card sm:w-64" aria-label="Trier">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(SORTS) as [Sort, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tous", count: counts.all },
            { value: "debt", label: "Doivent de l'argent", count: counts.debt },
            { value: "clear", label: "À jour", count: counts.clear },
            { value: "inactive", label: `Sans achat depuis ${INACTIVE_DAYS} j`, count: counts.inactive },
          ]}
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {rows.length} client{rows.length > 1 ? "s" : ""}
          </span>
          {active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setFilter(defaults.filter);
                setSort(defaults.sort);
              }}
            >
              <RotateCcw /> Réinitialiser
            </Button>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title={filter === "debt" && !q ? "Aucune dette en cours" : "Aucun client trouvé"}
          description={filter === "debt" && !q ? "Tous vos clients sont à jour. Bravo !" : "Essayez un autre mot ou un autre filtre."}
        />
      ) : (
        <>
          <div ref={setTop} className="scroll-mt-20" />
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {pager.items.map((c) => (
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
          <ClientPagination pager={pager} />
        </>
      )}
    </div>
  );
}

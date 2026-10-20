"use client";

import { CalendarDays, Loader2, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOM_PERIOD, PERIOD_PRESETS, type PeriodPreset } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { SearchInput } from "./search-input";

const ALL = "__all__";

export interface FilterSelect {
  /** Nom du paramètre dans l'adresse. */
  name: string;
  /** Texte de l'option « tout » (ex. « Tous les paiements »). */
  allLabel: string;
  value: string | null;
  options: { value: string; label: string }[];
}

export interface FilterPeriod {
  value: string;
  presets: readonly PeriodPreset[];
  /** Période utilisée quand rien n'est choisi (pas de paramètre dans l'adresse). */
  fallback: PeriodPreset;
  du?: string;
  au?: string;
  /** Libellé de la période personnalisée (ex. « Du 1 oct. au 15 oct. »). */
  customLabel?: string;
}

const chip =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground";
const chipOn = "border-primary/30 bg-accent text-accent-foreground hover:text-accent-foreground";

/**
 * Barre de filtres : recherche, listes déroulantes et période.
 * Chaque changement met à jour l'adresse de la page ; la page serveur relit les filtres.
 */
export function FilterBar({
  search,
  selects = [],
  period,
  resultLabel,
  extraKeys = [],
  className,
}: {
  search?: { value: string; placeholder: string };
  selects?: FilterSelect[];
  period?: FilterPeriod;
  /** Résumé affiché à droite (ex. « 42 ventes »). */
  resultLabel?: string;
  /** Autres paramètres effacés par « Réinitialiser ». */
  extraKeys?: string[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Recherche : on attend la fin de la frappe avant de recharger
  const [q, setQ] = useState(search?.value ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (!search) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (q.trim() !== (search.value ?? "")) apply({ q: q.trim() || null });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const keys = ["q", "periode", "du", "au", ...selects.map((s) => s.name), ...extraKeys];
  const active = keys.some((k) => searchParams.has(k));

  return (
    <div className={cn("mb-5 space-y-3", className)}>
      {(search || selects.length > 0) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {search && <SearchInput value={q} onChange={setQ} placeholder={search.placeholder} className="sm:min-w-64 sm:flex-1" />}
          {selects.map((s) => (
            <Select key={s.name} value={s.value ?? ALL} onValueChange={(v) => apply({ [s.name]: v === ALL ? null : v })}>
              <SelectTrigger
                aria-label={s.allLabel}
                className={cn("h-11 w-full bg-card sm:w-auto sm:min-w-44", s.value && "border-primary/40 text-accent-foreground")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{s.allLabel}</SelectItem>
                {s.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {period && <PeriodChips period={period} onChange={apply} />}
        <div className="ml-auto flex items-center gap-3">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Mise à jour…" />}
          {resultLabel && <span className="text-sm text-muted-foreground">{resultLabel}</span>}
          {active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                apply(Object.fromEntries(keys.map((k) => [k, null])));
              }}
            >
              <RotateCcw /> Réinitialiser
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PeriodChips({ period, onChange }: { period: FilterPeriod; onChange: (u: Record<string, string | null>) => void }) {
  const [open, setOpen] = useState(false);
  const [du, setDu] = useState(period.du ?? "");
  const [au, setAu] = useState(period.au ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const isCustom = period.value === CUSTOM_PERIOD;

  return (
    <div className="scroll-row -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Période">
      {period.presets.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={period.value === key}
          onClick={() => onChange({ periode: key === period.fallback ? null : key, du: null, au: null })}
          className={cn(chip, period.value === key && chipOn)}
        >
          {PERIOD_PRESETS[key]}
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-pressed={isCustom} className={cn(chip, isCustom && chipOn)}>
            <CalendarDays className="size-3.5" />
            {isCustom && period.customLabel ? period.customLabel : "Dates…"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!du && !au) return;
              onChange({ periode: CUSTOM_PERIOD, du: du || au, au: au || du });
              setOpen(false);
            }}
          >
            <p className="text-sm font-semibold">Choisir les dates</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="filtre-du">Du</Label>
                <Input id="filtre-du" type="date" max={today} value={du} onChange={(e) => setDu(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filtre-au">Au</Label>
                <Input id="filtre-au" type="date" max={today} value={au} onChange={(e) => setAu(e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={!du && !au}>
              Afficher
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}

"use client";

import { Check, ChevronRight, ClipboardCheck, HelpCircle, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductThumb } from "@/components/products/product-thumb";
import { FormError } from "@/components/shared/form-field";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { SignedQty } from "@/components/stock/movement-label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA, formatQty, unitAllowsDecimals } from "@/lib/format";
import { cn } from "@/lib/utils";
import { submitInventory, type InventoryLine } from "@/server/actions/stock";

export interface InventoryProduct {
  id: string;
  name: string;
  unit: string;
  physical: number;
  costPrice: number;
  imageUrl: string | null;
  categoryName: string | null;
}

type View = "tous" | "a-compter" | "ecarts";

export function InventoryForm({
  products,
  showCost,
  locationName,
  firstTime,
}: {
  products: InventoryProduct[];
  showCost: boolean;
  locationName: string;
  /** Premier inventaire : l'explication est ouverte (on peut la refermer). */
  firstTime: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("tous");
  const [counts, setCounts] = useState<Record<string, number | "">>({});
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ inventoryId: string; lines: InventoryLine[]; checked: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counted = Object.entries(counts).filter(([, v]) => v !== "");
  const diffOf = (p: InventoryProduct) => {
    const v = counts[p.id];
    return v === undefined || v === "" ? null : Math.round((Number(v) - p.physical) * 1000) / 1000;
  };
  const gaps = products.filter((p) => {
    const d = diffOf(p);
    return d !== null && d !== 0;
  });
  const missing = gaps.reduce((s, p) => s + Math.min(0, diffOf(p)!) * p.costPrice, 0);
  const surplus = gaps.reduce((s, p) => s + Math.max(0, diffOf(p)!) * p.costPrice, 0);
  const visible = products.filter((p) => {
    if (!matchesSearch(q, p.name, p.categoryName)) return false;
    if (view === "a-compter") return counts[p.id] === undefined || counts[p.id] === "";
    if (view === "ecarts") return gaps.includes(p);
    return true;
  });

  function askConfirm() {
    setError(null);
    if (counted.length === 0) return setError("Saisissez au moins une quantité comptée.");
    setConfirm(true);
  }

  function submit() {
    startTransition(async () => {
      const res = await submitInventory({ counts: counted.map(([productId, v]) => ({ productId, counted: Number(v) })) });
      setConfirm(false);
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      setCounts({});
      toast.success("Inventaire enregistré");
      router.refresh();
    });
  }

  if (result) {
    const lossValue = result.lines.filter((l) => l.difference < 0).reduce((s, l) => s + l.value, 0);
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardCheck className="size-5 text-primary" /> Inventaire terminé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {result.checked} produit{result.checked > 1 ? "s" : ""} compté{result.checked > 1 ? "s" : ""} ·{" "}
            {result.lines.length === 0
              ? "tout était là, aucun écart."
              : `${result.lines.length} écart${result.lines.length > 1 ? "s" : ""} : le stock de l'application a été corrigé.`}
          </p>
          {showCost && lossValue < 0 && (
            <div className="rounded-xl bg-destructive/10 p-4 text-destructive">
              <p className="text-sm font-medium">Valeur des produits manquants (au prix d&apos;achat)</p>
              <p className="num text-2xl font-semibold">{formatFCFA(-lossValue)}</p>
            </div>
          )}
          {result.lines.length > 0 && (
            <ul className="divide-y rounded-xl border">
              {result.lines.map((l) => (
                <li key={l.productId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.name}</p>
                    <p className="num text-xs text-muted-foreground">
                      Attendu {formatQty(l.expected, l.unit)} · compté {formatQty(l.counted, l.unit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <SignedQty quantity={l.difference} unit={l.unit} />
                    {showCost && l.value !== 0 && <p className="num text-xs text-muted-foreground">{formatFCFA(l.value)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/stock/inventaire/${result.inventoryId}`}>
                Voir la fiche de l&apos;inventaire <ChevronRight />
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setResult(null)}>
              <RotateCcw /> Nouvel inventaire
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <details className="group rounded-xl border bg-card p-4 text-sm open:pb-5" open={firstTime}>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
          <HelpCircle className="size-4 text-primary" /> À quoi sert l&apos;inventaire ?
          <ChevronRight className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-3 space-y-3 text-muted-foreground">
          <p>
            L&apos;application calcule le stock à partir des ventes et des entrées. Mais dans la boutique, il peut y avoir des
            différences : vol, casse, oubli de saisie, erreur de quantité. L&apos;inventaire sert à <strong className="text-foreground">compter
            ce qu&apos;il y a vraiment</strong> sur les étagères, pour que le stock de l&apos;application soit juste.
          </p>
          <ol className="grid gap-2 sm:grid-cols-3">
            {[
              ["1", "Comptez", "Prenez les produits un par un et tapez la quantité trouvée. Le bouton ✓ veut dire « c'est juste »."],
              ["2", "Regardez les écarts", "Les produits où il manque (ou il y a trop) sont signalés en orange, avec leur valeur."],
              ["3", "Validez", "Le stock est corrigé et l'inventaire est gardé dans l'historique, avec les pertes."],
            ].map(([n, title, text]) => (
              <li key={n} className="rounded-lg bg-muted/50 p-3">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="num grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{n}</span>
                  {title}
                </p>
                <p className="mt-1 text-xs">{text}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs">
            Conseil : faites-le une fois par mois, ou par rayon (une catégorie à la fois). Inventaire de : <strong className="text-foreground">{locationName}</strong>.
          </p>
        </div>
      </details>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Summary label="Comptés" value={`${counted.length} / ${products.length}`} />
        <Summary label="Écarts" value={String(gaps.length)} tone={gaps.length > 0 ? "warn" : undefined} />
        <Summary
          label={showCost ? "Manque" : "Produits manquants"}
          value={showCost ? formatFCFA(-missing) : String(gaps.filter((p) => diffOf(p)! < 0).length)}
          tone={missing < 0 ? "danger" : undefined}
          hint={showCost && surplus > 0 ? `+${formatFCFA(surplus)} en trop` : undefined}
        />
      </div>

      <SearchInput value={q} onChange={setQ} placeholder="Rechercher un produit ou une catégorie…" />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Produits affichés">
        {(
          [
            ["tous", `Tous (${products.length})`],
            ["a-compter", `À compter (${products.length - counted.length})`],
            ["ecarts", `Écarts (${gaps.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm font-medium text-muted-foreground hover:text-foreground",
              view === key && "border-primary/30 bg-accent text-accent-foreground hover:text-accent-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {view === "ecarts" ? "Aucun écart pour l'instant." : view === "a-compter" ? "Tout est compté." : "Aucun produit ne correspond."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => {
            const value = counts[p.id] ?? "";
            const diff = diffOf(p);
            const gap = diff !== null && diff !== 0;
            return (
              <li
                key={p.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3",
                  gap && "border-saffron/60 ring-2 ring-saffron/25",
                  diff === 0 && "border-success/40",
                )}
              >
                <ProductThumb name={p.name} imageUrl={p.imageUrl} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="num text-xs text-muted-foreground">
                    Dans l&apos;application : {formatQty(p.physical, p.unit)}
                    {gap && (
                      <span className={cn("ml-1.5 font-semibold", diff! < 0 ? "text-destructive" : "text-success")}>
                        · {diff! < 0 ? `il manque ${formatQty(-diff!, p.unit)}` : `${formatQty(diff!, p.unit)} en trop`}
                      </span>
                    )}
                    {diff === 0 && <span className="ml-1.5 font-semibold text-success">· juste</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode={unitAllowsDecimals(p.unit) ? "decimal" : "numeric"}
                    min={0}
                    step={unitAllowsDecimals(p.unit) ? "0.001" : "1"}
                    value={value}
                    placeholder="Compté"
                    aria-label={`Quantité comptée pour ${p.name}`}
                    onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="num h-11 w-24 rounded-xl border border-input bg-card px-3 text-center text-base font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                  <Button
                    type="button"
                    variant={diff === 0 ? "default" : "outline"}
                    size="icon"
                    aria-label={`${p.name} : quantité juste`}
                    title="La quantité est juste"
                    onClick={() => setCounts((c) => ({ ...c, [p.id]: p.physical }))}
                  >
                    <Check />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="sticky bottom-24 z-20 lg:bottom-4">
        <FormError message={error} />
        <Button type="button" size="lg" className="mt-2 w-full shadow-lg" disabled={pending} onClick={askConfirm}>
          {pending && <Loader2 className="animate-spin" />}
          Valider l&apos;inventaire ({counted.length} produit{counted.length > 1 ? "s" : ""} compté{counted.length > 1 ? "s" : ""})
        </Button>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider l&apos;inventaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              {counted.length} produit{counted.length > 1 ? "s" : ""} compté{counted.length > 1 ? "s" : ""}.{" "}
              {gaps.length === 0
                ? "Aucun écart : le stock ne change pas, l'inventaire est simplement gardé dans l'historique."
                : `${gaps.length} écart${gaps.length > 1 ? "s" : ""} : le stock de l'application sera remplacé par vos quantités comptées.`}
              {showCost && missing < 0 && ` Valeur manquante : ${formatFCFA(-missing)}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Revoir</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {pending && <Loader2 className="animate-spin" />} Valider
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Summary({ label, value, tone, hint }: { label: string; value: string; tone?: "warn" | "danger"; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card px-2 py-3">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("num mt-0.5 text-base font-semibold sm:text-lg", tone === "warn" && "text-warning dark:text-saffron", tone === "danger" && "text-destructive")}>
        {value}
      </p>
      {hint && <p className="num text-[11px] text-success">{hint}</p>}
    </div>
  );
}

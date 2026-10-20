import Link from "next/link";
import { formatFCFA } from "@/lib/format";

/** Barres horizontales en HTML (une seule teinte : la grandeur, pas l'identité). Libellés et valeurs en texte. */
export function BarList({
  items,
  valueLabel = (v: number) => formatFCFA(v),
  emptyText = "Pas encore de données sur cette période.",
}: {
  items: { label: string; value: number; hint?: string; href?: string }[];
  valueLabel?: (value: number) => string;
  emptyText?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            {i.href ? (
              <Link href={i.href} className="truncate font-medium hover:text-primary hover:underline">
                {i.label}
              </Link>
            ) : (
              <span className="truncate font-medium">{i.label}</span>
            )}
            <span className="num shrink-0 font-semibold">
              {valueLabel(i.value)}
              {i.hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--chart-1)]"
              style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

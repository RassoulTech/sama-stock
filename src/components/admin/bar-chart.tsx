import { cn } from "@/lib/utils";

/**
 * Histogramme simple à une série (une seule couleur, la dernière barre mise en avant).
 * Chaque barre affiche sa valeur au survol et pour les lecteurs d'écran.
 */
export function BarChart({
  data,
  format,
  label,
}: {
  data: { key: string; label: string; value: number; tick?: string }[];
  format: (n: number) => string;
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const last = data.at(-1);
  const empty = data.every((d) => d.value === 0);

  return (
    <figure aria-label={label} className="relative">
      {empty && (
        <p className="absolute inset-x-0 top-14 text-center text-sm text-muted-foreground">Rien sur cette période pour l&apos;instant.</p>
      )}
      <div className="relative flex h-40 items-end gap-1 border-b">
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          return (
            <div key={d.key} className="group relative flex h-full flex-1 items-end" title={`${d.label} : ${format(d.value)}`}>
              <span className="sr-only">
                {d.label} : {format(d.value)}
              </span>
              <span
                className={cn(
                  "block w-full rounded-t-[4px] transition-colors",
                  isLast ? "bg-primary" : "bg-primary/25 group-hover:bg-primary/45",
                )}
                style={{ height: d.value > 0 ? `${Math.max(4, (d.value / max) * 100)}%` : "2px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex h-4 gap-1 text-[11px] text-muted-foreground" aria-hidden>
        {data.map((d, i) => (
          <span key={d.key} className="relative flex-1">
            {d.tick && (
              <span
                className={cn(
                  "absolute top-0 whitespace-nowrap",
                  i === 0 ? "left-0" : i === data.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                )}
              >
                {d.tick}
              </span>
            )}
          </span>
        ))}
      </div>
      {last && (
        <figcaption className="mt-2 text-xs text-muted-foreground">
          Dernière valeur ({last.label}) : <span className="num font-semibold text-foreground">{format(last.value)}</span>
        </figcaption>
      )}
    </figure>
  );
}

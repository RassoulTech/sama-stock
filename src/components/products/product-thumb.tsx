import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

// Teintes très légères + bordure : lisibles, sans effet « bonbon »
const PALETTE = [
  "bg-emerald-50 text-emerald-800 ring-emerald-900/10 dark:bg-emerald-950/60 dark:text-emerald-300",
  "bg-stone-100 text-stone-700 ring-stone-900/10 dark:bg-stone-900 dark:text-stone-300",
  "bg-amber-50 text-amber-800 ring-amber-900/10 dark:bg-amber-950/60 dark:text-amber-300",
  "bg-teal-50 text-teal-800 ring-teal-900/10 dark:bg-teal-950/60 dark:text-teal-300",
  "bg-slate-100 text-slate-700 ring-slate-900/10 dark:bg-slate-900 dark:text-slate-300",
];

function colorFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function ProductThumb({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- image privée servie par notre API, déjà compressée
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className={cn("size-10 shrink-0 rounded-lg bg-muted object-cover ring-1 ring-foreground/10", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg text-[0.8125rem] font-semibold tracking-tight ring-1 ring-inset",
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

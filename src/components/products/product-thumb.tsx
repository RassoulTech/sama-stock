import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
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
        className={cn("size-11 shrink-0 rounded-xl bg-muted object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold",
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

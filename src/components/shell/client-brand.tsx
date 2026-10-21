import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Logo et nom du commerce : l'application d'un client sous licence porte sa marque. */
export function ClientBrand({ name, logo, compact = false, className }: { name: string; logo: string | null; compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
        <img src={logo} alt="" className="size-7 shrink-0 rounded-[9px] bg-white object-cover ring-1 ring-white/30" />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-white/15 text-[11px] font-bold ring-1 ring-white/30">
          {initials(name)}
        </span>
      )}
      {!compact && <span className="truncate text-[0.9375rem] font-bold tracking-[-0.02em]">{name}</span>}
    </span>
  );
}

/** Mention discrète en bas du menu d'une application sous licence. */
export function PoweredBy() {
  return <p className="px-2 pt-2 text-[10px] tracking-wide text-sidebar-foreground/55 uppercase">Propulsé par Sama Stock</p>;
}

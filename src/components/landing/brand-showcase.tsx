import { BarChart3, Home, Package, ShoppingCart, Users } from "lucide-react";
import { BRAND_COLORS, type BrandColor } from "@/lib/domain/brand";
import { cn } from "@/lib/utils";

/** Commerces fictifs, pour montrer une même application à trois marques différentes. */
const EXAMPLES: {
  name: string;
  initials: string;
  color: BrandColor;
  sales: string;
  products: [string, string][];
}[] = [
  {
    name: "Quincaillerie Ndiaye",
    initials: "QN",
    color: "bleu",
    sales: "184 500",
    products: [
      ["Ciment 50 kg", "42 sacs"],
      ["Fer de 10", "120 barres"],
    ],
  },
  {
    name: "Awa Mode & Wax",
    initials: "AM",
    color: "bordeaux",
    sales: "96 000",
    products: [
      ["Bazin riche", "18 m"],
      ["Robe wax", "9 pièces"],
    ],
  },
  {
    name: "Diallo Cosmétiques",
    initials: "DC",
    color: "violet",
    sales: "57 250",
    products: [
      ["Beurre de karité", "26 pots"],
      ["Savon noir", "40 pièces"],
    ],
  },
];

/** Trois téléphones : la même application, au nom, au logo et aux couleurs de chaque commerce. */
export function BrandShowcase() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {EXAMPLES.map((e, i) => {
        const c = BRAND_COLORS[e.color];
        return (
          <figure key={e.name} className="reveal mx-auto w-full max-w-[16rem]">
            {/* Le téléphone du milieu est un peu plus haut (décalage séparé de l'animation d'apparition) */}
            <div className={cn(i === 1 && "sm:-translate-y-6")}>
              <div className="overflow-hidden rounded-[2rem] border-[6px] border-[#0b1310] bg-white text-[#0b1310] shadow-[0_32px_64px_-28px_rgb(11_19_16/0.45)]">
                <div className="flex items-center gap-2 px-3.5 pt-4 pb-3 text-white" style={{ backgroundColor: c.sidebar }}>
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-white text-[11px] font-bold"
                    style={{ color: c.primary }}
                  >
                    {e.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{e.name}</span>
                    <span className="block text-[10px] text-white/70">Boutique principale</span>
                  </span>
                </div>
                <div className="space-y-2.5 p-3.5">
                  <div className="rounded-xl p-3" style={{ backgroundColor: c.accent }}>
                    <p className="text-[10px] font-medium" style={{ color: c.accentForeground }}>
                      Ventes du jour
                    </p>
                    <p className="text-lg font-bold tracking-tight">
                      {e.sales} <span className="text-[11px] font-medium text-[#58635e]">FCFA</span>
                    </p>
                    <div className="mt-2 flex h-8 items-end gap-1">
                      {[40, 62, 48, 75, 58, 90, 70].map((h, j) => (
                        <span
                          key={j}
                          className="flex-1 rounded-t-[3px]"
                          style={{
                            height: `${h}%`,
                            backgroundColor: c.primary,
                            opacity: j === 6 ? 1 : 0.35,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {e.products.map(([p, q]) => (
                    <div key={p} className="flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11px]">
                      <span className="font-medium">{p}</span>
                      <span className="text-[#58635e]">{q}</span>
                    </div>
                  ))}
                  <div className="rounded-lg py-2 text-center text-[11px] font-semibold text-white" style={{ backgroundColor: c.primary }}>
                    Nouvelle vente
                  </div>
                </div>
                <div className="grid grid-cols-5 border-t px-1 py-2 text-[#58635e]">
                  {[Home, ShoppingCart, Package, Users, BarChart3].map((Icon, j) => (
                    <Icon key={j} className="mx-auto size-4" style={j === 0 ? { color: c.primary } : undefined} aria-hidden />
                  ))}
                </div>
              </div>
              <figcaption className="mt-3 text-center text-xs text-muted-foreground">{c.label}</figcaption>
            </div>
          </figure>
        );
      })}
    </div>
  );
}

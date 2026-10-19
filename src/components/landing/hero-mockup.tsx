import { AlertTriangle, Bike, CheckCheck, TrendingUp } from "lucide-react";

const BARS = [38, 52, 44, 66, 58, 80, 72];

/** Aperçu stylisé de l'application (HTML pur, aucune image à charger). */
export function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.25),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(11,110,79,0.25),transparent_55%)] blur-2xl" />
      <div className="grid grid-cols-6 gap-3">
        {/* Chiffre d'affaires */}
        <div className="col-span-4 rounded-3xl bg-card p-5 shadow-xl shadow-primary/10 ring-1 ring-foreground/[0.06]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Ventes aujourd&apos;hui</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
              <TrendingUp className="size-3" /> +18 %
            </span>
          </div>
          <p className="num mt-1 text-2xl font-extrabold tracking-tight">87 500 FCFA</p>
          <div className="mt-4 flex h-20 items-end gap-1.5">
            {BARS.map((h, i) => (
              <span
                key={i}
                className={`flex-1 rounded-t-[4px] ${i === BARS.length - 1 ? "bg-primary" : "bg-primary/25"}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        {/* Alerte stock */}
        <div className="col-span-2 flex flex-col justify-between rounded-3xl bg-saffron p-4 text-saffron-foreground shadow-xl shadow-saffron/20">
          <AlertTriangle className="size-5" />
          <div>
            <p className="text-[11px] font-semibold opacity-80">Stock bas</p>
            <p className="text-sm leading-tight font-extrabold">Ciment 50 kg</p>
            <p className="num text-xs font-medium">Reste 4 sacs</p>
          </div>
        </div>
        {/* Commande */}
        <div className="col-span-3 rounded-3xl bg-card p-4 shadow-xl shadow-primary/10 ring-1 ring-foreground/[0.06]">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-accent text-primary">
              <Bike className="size-4" />
            </span>
            <div>
              <p className="text-xs font-bold">C-0042 · Instagram</p>
              <p className="text-[11px] text-muted-foreground">Fatou Diop · Parcelles</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {[1, 1, 1, 0].map((on, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${on ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p className="mt-2 text-[11px] font-semibold text-primary">En livraison</p>
        </div>
        {/* Reçu WhatsApp */}
        <div className="col-span-3 rounded-3xl bg-[#e7fbe9] p-4 shadow-xl shadow-emerald-900/10 ring-1 ring-emerald-900/5 dark:bg-[#123524]">
          <p className="text-[11px] font-semibold text-[#128C4B] dark:text-[#5fe19a]">WhatsApp</p>
          <div className="mt-2 rounded-2xl rounded-tl-sm bg-white p-3 text-[11px] leading-relaxed text-[#0e1a16] shadow-sm dark:bg-[#1d4a33] dark:text-white">
            <p className="font-bold">Boutique Awa Mode</p>
            <p>Reçu V-0128</p>
            <p>2 × Robe wax : 30 000 FCFA</p>
            <p className="font-bold">Total : 30 000 FCFA</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-sky-500">
              10:24 <CheckCheck className="size-3" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

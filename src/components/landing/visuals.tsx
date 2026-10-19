import {
  AlertTriangle,
  BarChart3,
  Bike,
  Check,
  CheckCheck,
  EyeOff,
  LayoutDashboard,
  MessageCircle,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* Vignettes d'interface en HTML : nettes, légères, cohérentes avec l'application. */

function Pill({ tone, children }: { tone: "green" | "saffron" | "red" | "blue"; children: React.ReactNode }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    saffron: "bg-amber-50 text-amber-800 ring-amber-500/30",
    red: "bg-red-50 text-red-700 ring-red-600/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset", tones[tone])}>
      {children}
    </span>
  );
}

/** Aperçu principal : le tableau de bord, dans un cadre de navigateur. */
export function DashboardPreview() {
  const bars = [38, 52, 44, 63, 57, 78, 70];
  return (
    <div className="overflow-hidden rounded-xl border bg-white text-[#0b1310] shadow-[0_1px_2px_rgb(11_19_16/0.06),0_32px_64px_-24px_rgb(11_19_16/0.28)]">
      <div className="flex h-8 items-center gap-1.5 border-b bg-[#f6f7f6] px-3">
        <span className="size-2.5 rounded-full bg-[#e5e7e5]" />
        <span className="size-2.5 rounded-full bg-[#e5e7e5]" />
        <span className="size-2.5 rounded-full bg-[#e5e7e5]" />
        <span className="mx-auto rounded-md bg-white px-10 py-0.5 text-[10px] text-[#58635e] ring-1 ring-[#e5e8e5]">
          app.samastock.sn
        </span>
      </div>
      <div className="grid grid-cols-[112px_1fr]">
        <div className="space-y-1 border-r bg-[#fbfcfb] p-2.5 text-[10px] font-medium text-[#58635e]">
          {[
            [LayoutDashboard, "Tableau de bord", true],
            [ShoppingCart, "Vendre", false],
            [Bike, "Commandes", false],
            [Package, "Produits", false],
            [Users, "Clients", false],
            [BarChart3, "Rapports", false],
          ].map(([Icon, label, active]) => {
            const I = Icon as typeof Package;
            return (
              <div
                key={label as string}
                className={cn("flex items-center gap-1.5 rounded-md px-1.5 py-1", active && "bg-[#eef1ee] text-[#0b1310]")}
              >
                <I className={cn("size-3", active && "text-[#0b6e4f]")} /> {label as string}
              </div>
            );
          })}
        </div>
        <div className="space-y-2.5 p-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Aujourd'hui", "87 500"],
              ["7 jours", "612 000"],
              ["Bénéfice du mois", "1 245 300"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border p-2">
                <p className="text-[9px] text-[#58635e]">{label}</p>
                <p className="num mt-1 text-[13px] font-semibold tracking-tight">
                  {value} <span className="text-[8px] font-medium text-[#58635e]">FCFA</span>
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1.4fr_1fr] gap-2">
            <div className="rounded-lg border p-2">
              <p className="text-[9px] font-medium">Ventes des 7 derniers jours</p>
              <div className="mt-2 flex h-16 items-end gap-1">
                {bars.map((h, i) => (
                  <span
                    key={i}
                    className={cn("flex-1 rounded-t-[3px]", i === bars.length - 1 ? "bg-[#0a7a55]" : "bg-[#0a7a55]/25")}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5 rounded-lg border p-2">
              <p className="text-[9px] font-medium">Alertes de stock</p>
              {[
                ["Ciment 50 kg", "Stock bas", "saffron"],
                ["Mèches brésiliennes", "Rupture", "red"],
                ["Robe wax", "Stock bas", "saffron"],
              ].map(([name, label, tone]) => (
                <div key={name} className="flex items-center justify-between gap-1">
                  <span className="truncate text-[9px]">{name}</span>
                  <Pill tone={tone as "saffron" | "red"}>{label}</Pill>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-medium">Commandes en cours</p>
              <span className="text-[9px] text-[#58635e]">3</span>
            </div>
            {[
              ["C-0042 · Fatou Diop", "Instagram", "En livraison", "blue"],
              ["C-0043 · Moussa Fall", "WhatsApp", "Nouvelle", "saffron"],
            ].map(([who, channel, status, tone]) => (
              <div key={who} className="mt-1.5 flex items-center justify-between text-[9px]">
                <span>
                  {who} <span className="text-[#58635e]">· {channel}</span>
                </span>
                <Pill tone={tone as "blue" | "saffron"}>{status}</Pill>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bulle de reçu WhatsApp. */
export function WhatsAppReceipt({ className }: { className?: string }) {
  return (
    <div className={cn("w-60 rounded-xl bg-[#e7fbe9] p-3 shadow-[0_20px_40px_-16px_rgb(11_19_16/0.35)] ring-1 ring-emerald-900/10", className)}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#128c4b]">
        <MessageCircle className="size-3" /> WhatsApp
      </p>
      <div className="mt-2 rounded-lg rounded-tl-sm bg-white p-2.5 text-[10.5px] leading-relaxed text-[#0b1310] shadow-sm">
        <p className="font-semibold">Boutique Awa Mode</p>
        <p className="text-[#58635e]">Reçu V-0128</p>
        <p className="mt-1">2 × Robe wax : 30 000 FCFA</p>
        <p className="font-semibold">Total : 30 000 FCFA</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[9px] text-sky-500">
          10:24 <CheckCheck className="size-3" />
        </p>
      </div>
    </div>
  );
}

/** Notification d'alerte de stock. */
export function StockAlertToast({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-64 items-start gap-2.5 rounded-xl border bg-white p-3 text-[#0b1310] shadow-[0_20px_40px_-16px_rgb(11_19_16/0.35)]", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-500/30">
        <AlertTriangle className="size-4" />
      </span>
      <div>
        <p className="text-[11px] font-semibold">Ciment 50 kg : stock bas</p>
        <p className="text-[10px] text-[#58635e]">Il reste 4 sacs. Seuil d&apos;alerte : 10.</p>
        <p className="mt-1.5 text-[10px] font-semibold text-[#0b6e4f]">Réapprovisionner →</p>
      </div>
    </div>
  );
}

/* ─── Vignettes des fonctionnalités ─────────────────────────────────────── */

export function PosVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="rounded-xl border bg-white p-3 text-[#0b1310]">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Savon", "1 500"],
            ["Robe wax", "15 000"],
            ["Karité", "3 000"],
            ["Foulard", "5 000"],
            ["Encens", "2 500"],
            ["Parfum", "12 000"],
          ].map(([n, price], i) => (
            <div key={n} className={cn("rounded-lg border p-2", i === 1 && "border-[#0b6e4f] ring-1 ring-[#0b6e4f]")}>
              <span className="grid size-6 place-items-center rounded-md bg-emerald-50 text-[8px] font-semibold text-emerald-800 ring-1 ring-emerald-900/10 ring-inset">
                {n.slice(0, 2).toUpperCase()}
              </span>
              <p className="mt-1.5 truncate text-[10px] font-medium">{n}</p>
              <p className="num text-[9px] text-[#58635e]">{price} F</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-[#f59e0b] px-3 py-2 text-[11px] font-semibold text-[#1c1408]">
          <span>Encaisser</span>
          <span className="num">31 500 FCFA</span>
        </div>
      </div>
      <WhatsAppReceipt className="mx-auto w-56" />
    </div>
  );
}

export function OrderVisual() {
  const steps = ["Nouvelle", "Préparation", "Livraison", "Livrée"];
  return (
    <div className="rounded-xl border bg-white p-4 text-[#0b1310]">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold">
          Commande C-0042 <span className="font-normal text-[#58635e]">· Instagram</span>
        </p>
        <Pill tone="blue">En livraison</Pill>
      </div>
      <div className="mt-4 flex items-center">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-[10px] font-semibold",
                i < 2 ? "bg-[#0b6e4f] text-white" : i === 2 ? "bg-emerald-50 text-[#0b6e4f] ring-2 ring-[#0b6e4f]" : "bg-[#f3f5f3] text-[#58635e]",
              )}
            >
              {i < 2 ? <Check className="size-3" /> : i + 1}
            </span>
            {i < steps.length - 1 && <span className={cn("mx-1 h-0.5 flex-1 rounded", i < 2 ? "bg-[#0b6e4f]" : "bg-[#e5e8e5]")} />}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] text-[#58635e]">
        {steps.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="mt-4 space-y-1.5 rounded-lg bg-[#f8f9f8] p-2.5 text-[10.5px]">
        <div className="flex justify-between">
          <span>1 × Sac à main simili cuir</span>
          <span className="num">14 000 FCFA</span>
        </div>
        <div className="flex justify-between text-[#58635e]">
          <span>Livraison Liberté 6</span>
          <span className="num">1 500 FCFA</span>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-[#58635e]">Le sac est réservé : impossible de le vendre deux fois.</p>
    </div>
  );
}

export function CreditVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border bg-white p-4 text-[#0b1310]">
        <p className="text-[11px] text-[#58635e]">Rokhaya Mbaye doit</p>
        <p className="num mt-1 text-xl font-semibold tracking-tight text-red-600">
          25 000 <span className="text-[11px] font-medium text-[#58635e]">FCFA</span>
        </p>
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#25d366] py-2 text-[11px] font-semibold text-white">
          <MessageCircle className="size-3.5" /> Rappeler par WhatsApp
        </div>
        <div className="mt-2 rounded-lg border py-2 text-center text-[11px] font-medium">Enregistrer un remboursement</div>
      </div>
      <div className="rounded-xl bg-[#e7fbe9] p-3 ring-1 ring-emerald-900/10">
        <div className="rounded-lg rounded-tl-sm bg-white p-2.5 text-[10.5px] leading-relaxed text-[#0b1310] shadow-sm">
          Bonjour Rokhaya, petit rappel amical de <strong>Boutique Awa</strong> : il vous reste <strong>25 000 FCFA</strong> à
          régler. Merci et à bientôt !
        </div>
      </div>
    </div>
  );
}

export function TeamVisual() {
  const rows: [string, boolean, boolean][] = [
    ["Vendre et encaisser", true, true],
    ["Voir le stock", true, true],
    ["Voir les prix d'achat", true, false],
    ["Voir les bénéfices", true, false],
    ["Gérer l'abonnement", true, false],
  ];
  return (
    <div className="overflow-hidden rounded-xl border bg-white text-[#0b1310]">
      <div className="grid grid-cols-[1fr_72px_72px] border-b bg-[#f8f9f8] px-3 py-2 text-[10px] font-medium text-[#58635e]">
        <span>Droits</span>
        <span className="text-center">Vous</span>
        <span className="text-center">Vendeur</span>
      </div>
      {rows.map(([label, owner, seller]) => (
        <div key={label} className="grid grid-cols-[1fr_72px_72px] items-center border-b px-3 py-2 text-[11px] last:border-0">
          <span>{label}</span>
          {[owner, seller].map((ok, i) => (
            <span key={i} className="flex justify-center">
              {ok ? <Check className="size-3.5 text-[#0b6e4f]" /> : <EyeOff className="size-3.5 text-[#58635e]/60" />}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ReportVisual() {
  const items: [string, number][] = [
    ["Boubou brodé homme", 92],
    ["Robe wax longue", 84],
    ["Baskets toile", 66],
    ["Sac à main", 48],
  ];
  return (
    <div className="rounded-xl border bg-white p-4 text-[#0b1310]">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium">Produits les plus rentables</p>
        <p className="text-[10px] text-[#58635e]">30 jours</p>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map(([name, pct]) => (
          <div key={name}>
            <div className="flex justify-between text-[10.5px]">
              <span>{name}</span>
              <span className="num font-medium">{Math.round(pct * 3400).toLocaleString("fr-FR")} FCFA</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-[#f3f5f3]">
              <div className="h-full rounded-full bg-[#0a7a55]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

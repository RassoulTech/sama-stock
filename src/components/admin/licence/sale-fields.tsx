"use client";

import { Check } from "lucide-react";
import { FormField, SuffixInput } from "@/components/shared/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { LICENSE_ORDER, LICENSE_PACKS, limitLabel, type LicensePackId } from "@/lib/domain/plans";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SaleDraft {
  pack: LicensePackId;
  price: string;
  maintenancePrice: string;
  deposit: string;
  method: LicensePaymentMethod;
  note: string;
}

export const newSaleDraft = (pack: LicensePackId = "pro"): SaleDraft => ({
  pack,
  price: String(LICENSE_PACKS[pack].price),
  maintenancePrice: String(LICENSE_PACKS[pack].maintenancePrice),
  deposit: "",
  method: "wave",
  note: "",
});

export const saleInput = (d: SaleDraft) => ({
  pack: d.pack,
  price: Number(d.price || 0),
  maintenancePrice: Number(d.maintenancePrice || 0),
  deposit: Number(d.deposit || 0),
  method: d.method,
  note: d.note,
});

/** Forfait, prix négocié, maintenance et acompte d'une vente de licence. */
export function SaleFields({ value, onChange }: { value: SaleDraft; onChange: (d: SaleDraft) => void }) {
  const set = (patch: Partial<SaleDraft>) => onChange({ ...value, ...patch });
  const price = Number(value.price || 0);
  const list = LICENSE_PACKS[value.pack].price;
  const discount = list > 0 && price < list ? Math.round(((list - price) / list) * 100) : 0;
  const rest = Math.max(0, price - Number(value.deposit || 0));

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Forfait" className="grid gap-2 sm:grid-cols-3">
        {LICENSE_ORDER.map((id) => {
          const p = LICENSE_PACKS[id];
          const active = value.pack === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set({ pack: id, price: String(p.price), maintenancePrice: String(p.maintenancePrice) })}
              className={cn(
                "relative rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/40",
                active && "border-primary bg-accent/50 ring-1 ring-primary",
              )}
            >
              {active && <Check className="absolute top-3 right-3 size-4 text-primary" />}
              <span className="block text-sm font-semibold">{p.label}</span>
              <span className="num block text-lg font-semibold tracking-[-0.02em]">{formatFCFA(p.price)}</span>
              <span className="block text-xs text-muted-foreground">{p.tagline}</span>
              <span className="mt-1.5 block text-[11px] text-muted-foreground">
                {p.limits.maxEmployees === 0 ? "Sans employé" : limitLabel(p.limits.maxEmployees, "employés")} · {p.limits.maxLocations} boutique
                {p.limits.maxLocations > 1 ? "s" : ""}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Prix convenu"
          htmlFor="sale-price"
          hint={discount > 0 ? `Remise de ${discount} % sur le prix catalogue (${formatFCFA(list)}).` : "Prix catalogue : vous pouvez le négocier."}
        >
          <SuffixInput id="sale-price" suffix="FCFA" min={0} inputMode="numeric" value={value.price} onChange={(e) => set({ price: e.target.value })} />
        </FormField>
        <FormField label="Maintenance tous les 6 mois (après les 6 premiers mois)" htmlFor="sale-maintenance" hint="Les 6 premiers mois sont compris dans la licence.">
          <SuffixInput id="sale-maintenance" suffix="FCFA" min={0} inputMode="numeric" value={value.maintenancePrice} onChange={(e) => set({ maintenancePrice: e.target.value })} />
        </FormField>
        <FormField label="Acompte reçu aujourd'hui" htmlFor="sale-deposit" hint={price > 0 ? `Reste à payer : ${formatFCFA(rest)}` : undefined}>
          <SuffixInput id="sale-deposit" suffix="FCFA" min={0} inputMode="numeric" placeholder="0" value={value.deposit} onChange={(e) => set({ deposit: e.target.value })} />
        </FormField>
        <FormField label="Payé par">
          <Select value={value.method} onValueChange={(v) => set({ method: v as LicensePaymentMethod })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(LICENSE_PAYMENT_METHODS) as [LicensePaymentMethod, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Note (facultatif)" htmlFor="sale-note">
        <Textarea id="sale-note" rows={2} maxLength={500} placeholder="Ex. : solde à l'installation, samedi." value={value.note} onChange={(e) => set({ note: e.target.value })} />
      </FormField>
    </div>
  );
}

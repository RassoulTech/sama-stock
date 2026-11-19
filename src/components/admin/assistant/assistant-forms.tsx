"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { FormField, SuffixInput } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { montantParDefaut, type GenrePaiement } from "@/lib/domain/assistant/abonnement";
import { ASSISTANT_RECHARGE, ASSISTANT_RENEW_MAX_MONTHS, type LicensePackId } from "@/lib/domain/plans";
import { cn } from "@/lib/utils";
import { adminActiverAssistant, adminAnnulerPaiementAssistant, adminRechargerAssistant, adminRenouvelerAssistant } from "@/server/actions/assistant-abonnement";

const TITRES: Record<GenrePaiement, [string, string]> = {
  activation: ["Activation", "Une fois, avec les premiers mois"],
  mois: ["Renouveler", `1 à ${ASSISTANT_RENEW_MAX_MONTHS} mois, à la suite`],
  recharge: ["Recharge", `+${ASSISTANT_RECHARGE.credits} conversations ce mois-ci`],
};

/** Saisie d'un paiement de Finch : activation, renouvellement ou recharge, montant pré-rempli au prix catalogue. */
export function AssistantPaymentForm({ businessId, offre, choix }: { businessId: string; offre: LicensePackId; choix: GenrePaiement[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<GenrePaiement>(choix[0]);
  const [months, setMonths] = useState("1");
  const [amount, setAmount] = useState(String(montantParDefaut(offre, choix[0], 1)));
  const [method, setMethod] = useState<LicensePaymentMethod>("wave");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  function choisir(k: GenrePaiement) {
    setKind(k);
    setAmount(String(montantParDefaut(offre, k, Number(months) || 1)));
  }

  function changerMois(v: string) {
    setMonths(v);
    setAmount(String(montantParDefaut(offre, kind, Number(v) || 1)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res =
      kind === "activation"
        ? await adminActiverAssistant(businessId, { months, amount, method, note })
        : kind === "mois"
          ? await adminRenouvelerAssistant(businessId, { months, amount, method, note })
          : await adminRechargerAssistant(businessId, { amount, method, note });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(kind === "recharge" ? `${ASSISTANT_RECHARGE.credits} conversations ajoutées` : kind === "activation" ? "Finch activé" : "Finch renouvelé");
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {choix.length > 1 && (
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {choix.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => choisir(k)}
              className={cn("rounded-xl border p-3 text-left text-sm", kind === k && "border-primary bg-accent/50 ring-1 ring-primary")}
            >
              <span className="block font-semibold">{TITRES[k][0]}</span>
              <span className="block text-xs text-muted-foreground">{TITRES[k][1]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {kind !== "recharge" && (
          <FormField label="Mois payés" htmlFor="finch-mois">
            <Input id="finch-mois" type="number" min={1} max={ASSISTANT_RENEW_MAX_MONTHS} inputMode="numeric" value={months} onChange={(e) => changerMois(e.target.value)} />
          </FormField>
        )}
        <FormField label="Montant reçu" htmlFor="finch-montant">
          <SuffixInput id="finch-montant" suffix="FCFA" min={0} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <FormField label="Payé par">
          <Select value={method} onValueChange={(v) => setMethod(v as LicensePaymentMethod)}>
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
      <FormField label="Note (facultatif)" htmlFor="finch-note">
        <Input id="finch-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : payé par Wave le matin" />
      </FormField>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending && <Loader2 className="animate-spin" />}
        {kind === "activation" ? "Activer Finch" : kind === "mois" ? "Enregistrer et renouveler" : "Enregistrer la recharge"}
      </Button>
    </form>
  );
}

/** Annule le dernier paiement saisi (erreur de saisie), tant que ses crédits n'ont pas servi. */
export function AnnulerPaiementAssistant({ paymentId }: { paymentId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm">
          <Undo2 /> Annuler
        </Button>
      }
      title="Annuler ce paiement ?"
      description="Le paiement et les conversations qu'il ouvrait sont retirés. À faire seulement après une erreur de saisie."
      confirmLabel="Annuler le paiement"
      destructive
      successMessage="Paiement annulé"
      action={() => adminAnnulerPaiementAssistant(paymentId)}
    />
  );
}

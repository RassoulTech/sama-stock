"use client";

import { Ban, Banknote, CalendarPlus, CheckCircle2, Loader2, TimerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLANS } from "@/lib/domain/plans";
import { formatFCFA } from "@/lib/format";
import {
  adminExpireNow,
  adminExtend,
  adminRecordCashPayment,
  adminSetPlan,
  adminSetSuspended,
} from "@/server/actions/admin";

export function AdminActions({ businessId, plan, suspended }: { businessId: string; plan: string; suspended: boolean }) {
  const router = useRouter();
  const [newPlan, setNewPlan] = useState(plan);
  const [days, setDays] = useState(30);
  const [cashPlan, setCashPlan] = useState<"pro" | "business">(plan === "business" ? "business" : "pro");
  const [cashMonths, setCashMonths] = useState(1);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Erreur");
      else toast.success(success);
      router.refresh();
    });
  }

  const cashAmount = PLANS[cashPlan].price * cashMonths;

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border bg-accent/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Banknote className="size-4 text-primary" /> Encaisser un paiement en espèces
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
          <FormField label="Formule">
            <Select value={cashPlan} onValueChange={(v) => setCashPlan(v as "pro" | "business")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pro">Pro · {formatFCFA(PLANS.pro.price)} / mois</SelectItem>
                <SelectItem value="business">Business · {formatFCFA(PLANS.business.price)} / mois</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Nombre de mois" htmlFor="cash-months">
            <Input
              id="cash-months"
              type="number"
              min={1}
              max={12}
              value={cashMonths}
              onChange={(e) => setCashMonths(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
            />
          </FormField>
          <ConfirmAction
            trigger={<Button>Encaisser {formatFCFA(cashAmount)}</Button>}
            title={`Encaisser ${formatFCFA(cashAmount)} en espèces ?`}
            description={`La formule ${PLANS[cashPlan].label} est activée pour ${cashMonths * 30} jours (prolongée si elle est déjà en cours). Le montant est compté dans les revenus.`}
            confirmLabel="Confirmer l'encaissement"
            successMessage="Paiement en espèces enregistré"
            action={() => adminRecordCashPayment(businessId, { plan: cashPlan, months: cashMonths })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Ajustement manuel (sans paiement)</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
          <FormField label="Formule">
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Essai</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Durée (jours)" htmlFor="admin-days">
            <Input id="admin-days" type="number" min={1} max={366} value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </FormField>
          <Button disabled={pending} onClick={() => run(() => adminSetPlan(businessId, { plan: newPlan, days }), "Formule mise à jour")}>
            {pending && <Loader2 className="animate-spin" />}
            Appliquer
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={() => run(() => adminExtend(businessId, 7), "Prolongé de 7 jours")}>
          <CalendarPlus /> Prolonger de 7 jours
        </Button>
        <ConfirmAction
          trigger={
            <Button variant="outline">
              <TimerOff /> Faire expirer maintenant
            </Button>
          }
          title="Faire expirer maintenant ?"
          description="Le commerce passera immédiatement en consultation seule. Utile pour tester ; réversible en changeant la formule."
          confirmLabel="Faire expirer"
          successMessage="Essai / abonnement expiré"
          action={() => adminExpireNow(businessId)}
        />
        {suspended ? (
          <Button variant="outline" disabled={pending} onClick={() => run(() => adminSetSuspended(businessId, false), "Commerce réactivé")}>
            <CheckCircle2 /> Réactiver
          </Button>
        ) : (
          <ConfirmAction
            trigger={
              <Button variant="destructive">
                <Ban /> Suspendre
              </Button>
            }
            title="Suspendre ce commerce ?"
            description="Plus personne ne pourra accéder au commerce. Les données sont conservées et vous pourrez le réactiver."
            confirmLabel="Suspendre"
            destructive
            successMessage="Commerce suspendu"
            action={() => adminSetSuspended(businessId, true)}
          />
        )}
      </div>
    </div>
  );
}

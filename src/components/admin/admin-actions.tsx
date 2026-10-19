"use client";

import { Ban, CalendarPlus, CheckCircle2, Loader2, TimerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminExpireNow, adminExtend, adminSetPlan, adminSetSuspended } from "@/server/actions/admin";

export function AdminActions({ businessId, plan, suspended }: { businessId: string; plan: string; suspended: boolean }) {
  const router = useRouter();
  const [newPlan, setNewPlan] = useState(plan);
  const [days, setDays] = useState(30);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Erreur");
      else toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-semibold">Changer la formule</p>
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

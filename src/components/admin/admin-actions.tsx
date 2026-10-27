"use client";

import { Ban, CalendarPlus, CheckCircle2, TimerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { adminExpireNow, adminExtend, adminSetSuspended } from "@/server/actions/admin";

/**
 * Actions sur un commerce en essai gratuit : prolonger l'essai, l'arrêter, suspendre.
 * La licence se vend avec « Vendre une licence » (elle n'expire jamais).
 */
export function AdminActions({ businessId, licensed, suspended }: { businessId: string; licensed: boolean; suspended: boolean }) {
  const router = useRouter();
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
    <div className="space-y-4">
      {!licensed && (
        <section className="space-y-3 rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarPlus className="size-4 text-primary" /> Prolonger l&apos;essai gratuit
          </p>
          <div className="flex flex-wrap gap-2">
            {[7, 14, 30].map((d) => (
              <Button key={d} variant="outline" size="sm" disabled={pending} onClick={() => run(() => adminExtend(businessId, d), `Essai prolongé de ${d} jours`)}>
                + {d} jours
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Ajoutés à la fin de l&apos;essai (ou à partir d&apos;aujourd&apos;hui s&apos;il est terminé).</p>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-xl border border-destructive/20 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <p className="text-sm font-semibold sm:mr-auto">Zone sensible</p>
        {!licensed && (
          <ConfirmAction
            trigger={
              <Button variant="outline" size="sm">
                <TimerOff /> Arrêter l&apos;essai maintenant
              </Button>
            }
            title="Arrêter l'essai maintenant ?"
            description="Le commerce passera immédiatement en consultation seule. Réversible en prolongeant l'essai."
            confirmLabel="Arrêter l'essai"
            successMessage="Essai arrêté"
            action={() => adminExpireNow(businessId)}
          />
        )}
        {suspended ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => adminSetSuspended(businessId, false), "Commerce réactivé")}>
            <CheckCircle2 /> Réactiver le commerce
          </Button>
        ) : (
          <ConfirmAction
            trigger={
              <Button variant="destructive" size="sm">
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
      </section>
    </div>
  );
}

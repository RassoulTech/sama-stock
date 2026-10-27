import { Clock, Lock } from "lucide-react";
import Link from "next/link";
import type { PlanState } from "@/lib/domain/plans";

/** Bandeau de l'essai gratuit : jours restants, ou fin de l'essai (consultation seule) avec l'achat de la licence. */
export function PlanBanner({ plan, canManageBilling }: { plan: PlanState; canManageBilling: boolean }) {
  if (plan.license) return null;
  if (plan.readOnly && plan.status !== "suspended") {
    return (
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1">
          <Lock className="size-4 shrink-0 text-warning" />
          <span className="font-medium">Votre essai gratuit est terminé. Le compte est en consultation seule.</span>
          {canManageBilling ? (
            <Link href="/licence" className="font-semibold text-primary underline-offset-4 hover:underline">
              Acheter la licence
            </Link>
          ) : (
            <span className="text-muted-foreground">Prévenez le propriétaire du commerce.</span>
          )}
        </div>
      </div>
    );
  }

  if (plan.status === "trialing") {
    return (
      <div className="border-b bg-accent/70 px-4 py-2 text-sm text-accent-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1">
          <Clock className="size-4 shrink-0" />
          <span>
            Essai gratuit :{" "}
            <strong>
              {plan.daysLeft} jour{plan.daysLeft > 1 ? "s" : ""} restant{plan.daysLeft > 1 ? "s" : ""}
            </strong>
          </span>
          {canManageBilling && (
            <Link href="/licence" className="font-semibold text-primary underline-offset-4 hover:underline">
              Voir les licences
            </Link>
          )}
        </div>
      </div>
    );
  }

  return null;
}

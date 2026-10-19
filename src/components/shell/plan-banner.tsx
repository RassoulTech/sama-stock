import { Clock, Lock } from "lucide-react";
import Link from "next/link";
import type { PlanState } from "@/lib/domain/plans";

export function PlanBanner({ plan, canManageBilling }: { plan: PlanState; canManageBilling: boolean }) {
  if (plan.readOnly) {
    return (
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1">
          <Lock className="size-4 shrink-0 text-warning" />
          <span className="font-medium">
            {plan.plan === "trial" ? "Votre essai gratuit est terminé." : "Votre abonnement a expiré."} Le compte est
            en consultation seule.
          </span>
          {canManageBilling ? (
            <Link href="/abonnement" className="font-semibold text-primary underline-offset-4 hover:underline">
              Choisir une formule
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
            <Link href="/abonnement" className="font-semibold text-primary underline-offset-4 hover:underline">
              Choisir une formule
            </Link>
          )}
        </div>
      </div>
    );
  }

  return null;
}

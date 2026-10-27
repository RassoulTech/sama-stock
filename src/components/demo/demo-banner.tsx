import { FlaskConical } from "lucide-react";
import { DEMO_LICENCE, LICENSE_PACKS, type PlanId } from "@/lib/domain/plans";
import { DemoButton } from "./demo-button";
import { DemoSignupButton } from "./demo-signup-button";

const ORDER: PlanId[] = ["trial", "pro", "business"];

/** Bandeau affiché en haut de l'application dans une boutique de démonstration. */
export function DemoBanner({ plan }: { plan: PlanId }) {
  return (
    <div className="border-b border-saffron/30 bg-saffron/12 dark:bg-saffron/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
        <p className="flex min-w-0 items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-warning dark:text-saffron" />
          <span>
            <strong className="font-semibold">Démo · licence {LICENSE_PACKS[DEMO_LICENCE[plan]].label}</strong>
            <span className="text-muted-foreground"> — boutique fictive, remise à zéro chaque jour.</span>
          </span>
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden text-xs text-muted-foreground md:inline">Comparer :</span>
          {ORDER.filter((p) => p !== plan).map((p) => (
            <DemoButton key={p} plan={p} size="sm" variant="outline" className="h-8 bg-card">
              {LICENSE_PACKS[DEMO_LICENCE[p]].label}
            </DemoButton>
          ))}
          <DemoSignupButton size="sm" className="h-8">
            Créer mon compte gratuit
          </DemoSignupButton>
        </div>
      </div>
    </div>
  );
}

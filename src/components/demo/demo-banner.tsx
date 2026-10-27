import { FlaskConical } from "lucide-react";
import { DEMO_LICENCE, LICENSE_PACKS, type PlanId } from "@/lib/domain/plans";
import { DemoButton } from "./demo-button";
import { DemoSignupButton } from "./demo-signup-button";

const ORDER: PlanId[] = ["trial", "pro", "business"];

/** Bandeau affiché en haut de l'application dans une boutique de démonstration (compact sur téléphone). */
export function DemoBanner({ plan }: { plan: PlanId }) {
  return (
    <div className="border-b border-saffron/30 bg-saffron/12 dark:bg-saffron/10">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:px-6 sm:py-2.5 lg:px-8">
        <p className="flex min-w-0 items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-warning dark:text-saffron" />
          <span className="truncate">
            <strong className="font-semibold">Démo · licence {LICENSE_PACKS[DEMO_LICENCE[plan]].label}</strong>
            <span className="text-muted-foreground">
              {" "}
              — boutique fictive<span className="hidden sm:inline">, remise à zéro chaque jour</span>
            </span>
          </span>
        </p>
        {/* Téléphone : une seule ligne qui défile, pour laisser la place à l'application */}
        <div className="scroll-row -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:ml-auto sm:overflow-visible sm:px-0 sm:pb-0">
          <span className="hidden text-xs text-muted-foreground md:inline">Comparer :</span>
          {ORDER.filter((p) => p !== plan).map((p) => (
            <DemoButton key={p} plan={p} size="sm" variant="outline" className="h-8 shrink-0 bg-card">
              {LICENSE_PACKS[DEMO_LICENCE[p]].label}
            </DemoButton>
          ))}
          <DemoSignupButton size="sm" className="h-8 shrink-0">
            Créer mon compte gratuit
          </DemoSignupButton>
        </div>
      </div>
    </div>
  );
}

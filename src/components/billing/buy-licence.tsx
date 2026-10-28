import { Check, Clock, Lock, MessageCircle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { LICENSE_ORDER, LICENSE_PACKS, licenceFeatures, type LicensePackId, type PlanState } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { salesLink } from "@/lib/whatsapp";

const STEPS = [
  ["Choisissez votre licence", "Selon votre équipe et le nombre de boutiques."],
  ["On l'installe chez vous", "Votre nom, votre logo et vos couleurs, vos appareils et vos employés."],
  ["Payez une seule fois", "Wave, Orange Money ou espèces. L'application est à vous, avec tout ce que vous avez saisi pendant l'essai."],
] as const;

/** Page « Licence » pendant (ou après) l'essai gratuit : les trois licences, achetées une fois. */
export function BuyLicence({ plan, businessName }: { plan: PlanState; businessName: string }) {
  const ended = plan.readOnly;
  const message = (id: LicensePackId) =>
    `Bonjour Sama Stock, je souhaite la *licence ${LICENSE_PACKS[id].label}* pour mon commerce *${businessName}*${ended ? " (essai terminé)" : " (essai en cours)"}. Pouvez-vous m'installer l'application ?`;

  return (
    <>
      <PageHeader title="Ma licence" description="Achetez Sama Stock une fois : l'application est à vous pour toujours." />

      <Card className={cn("mb-6", ended ? "border-warning/40" : "border-primary/30")}>
        <CardContent className="flex items-center gap-4">
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", ended ? "bg-warning/12 text-warning dark:text-saffron" : "bg-accent text-primary")}>
            {ended ? <Lock className="size-6" /> : <Clock className="size-6" />}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold">{ended ? "Votre essai gratuit est terminé" : "Essai gratuit en cours"}</p>
            <p className="text-sm text-muted-foreground">
              {ended
                ? "Vos données sont gardées, en consultation seule. Elles reviennent dès que votre licence est activée."
                : plan.endsAt
                  ? `Jusqu'au ${formatDate(plan.endsAt)} · ${plan.daysLeft} jour${plan.daysLeft > 1 ? "s" : ""} restant${plan.daysLeft > 1 ? "s" : ""}`
                  : "Découvrez tout, puis choisissez votre licence."}
            </p>
          </div>
        </CardContent>
      </Card>

      <ol className="mb-8 grid gap-3 sm:grid-cols-3">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="num grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>
              {title}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 md:grid-cols-3">
        {LICENSE_ORDER.map((id) => {
          const p = LICENSE_PACKS[id];
          return (
            <div key={id} className="flex flex-col rounded-2xl border bg-card p-6">
              <h2 className="text-[1.0625rem] font-semibold">Licence {p.label}</h2>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.tagline}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="num text-[2.25rem] leading-none font-semibold tracking-[-0.04em]">{p.price.toLocaleString("fr-FR")}</span>
                <span className="text-sm text-muted-foreground">FCFA</span>
              </p>
              <p className="mt-2 text-sm">
                <span className="font-medium">Une seule fois.</span>{" "}
                <span className="text-muted-foreground">Ensuite, maintenance facultative : {formatFCFA(p.maintenancePrice)} tous les 6 mois.</span>
              </p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {licenceFeatures(p).map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={salesLink(message(id))}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <MessageCircle className="size-4" /> Choisir la licence {p.label}
              </a>
            </div>
          );
        })}
      </div>
      <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" /> Acompte à la commande, solde à l&apos;installation · facture à votre nom
      </p>
    </>
  );
}

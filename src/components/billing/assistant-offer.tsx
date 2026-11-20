import { Mic } from "lucide-react";
import { NOM_ASSISTANT } from "@/lib/domain/assistant/nom";
import { ASSISTANT_OFFERS, ASSISTANT_RECHARGE, ASSISTANT_TRIAL_CREDITS, LICENSE_ORDER, LICENSE_PACKS, type LicensePackId } from "@/lib/domain/plans";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";

/** L'offre Finch d'un forfait en une phrase : conditions de vente, guide de la démo. */
export function texteOffreAssistant(pack: LicensePackId): string {
  const o = ASSISTANT_OFFERS[pack];
  return `installation ${formatFCFA(o.activationPrice)}, puis ${formatFCFA(o.monthlyPrice)} par mois pour ${o.monthlyCredits} conversations`;
}

/** Les trois offres Finch et leurs règles, pour la foire aux questions du site. */
export function reponseOffreAssistant(): string {
  const offres = LICENSE_ORDER.map((id) => `licence ${LICENSE_PACKS[id].label} : ${texteOffreAssistant(id)}`).join(" ; ");
  return (
    `${NOM_ASSISTANT} se paie à part de la licence, chaque mois. Selon votre licence — ${offres}. ` +
    `1 crédit = 1 conversation ; les crédits non utilisés sont perdus à la fin du mois. Besoin de plus ? Une recharge de ` +
    `${ASSISTANT_RECHARGE.credits} conversations coûte ${formatFCFA(ASSISTANT_RECHARGE.price)}. Pendant l'essai gratuit, ` +
    `${ASSISTANT_TRIAL_CREDITS} conversations sont offertes. Sans abonnement, le reste de l'application marche normalement.`
  );
}

/** Encadré de l'assistant vocal Finch dans la carte d'un forfait : en option, payé à part chaque mois. */
export function AssistantOffer({ pack, className }: { pack: LicensePackId; className?: string }) {
  const o = ASSISTANT_OFFERS[pack];
  return (
    <div className={cn("rounded-xl border border-dashed bg-muted/40 p-4 text-sm", className)}>
      <p className="flex items-center gap-2 font-semibold">
        <Mic className="size-4 shrink-0 text-primary" /> Assistant vocal {NOM_ASSISTANT}
        <span className="ml-auto shrink-0 rounded-md border bg-card px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
          En option
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Abonnement à part de la licence, payé chaque mois.</p>
      <dl className="mt-3 space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0 text-muted-foreground">Installation (une fois)</dt>
          <dd className="num shrink-0 font-medium whitespace-nowrap">{formatFCFA(o.activationPrice)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0 text-muted-foreground">Chaque mois</dt>
          <dd className="num shrink-0 font-medium whitespace-nowrap">{formatFCFA(o.monthlyPrice)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0 text-muted-foreground">Conversations par mois</dt>
          <dd className="num shrink-0 font-medium whitespace-nowrap">{o.monthlyCredits}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">1 crédit = 1 conversation, valable jusqu&apos;à la fin du mois.</p>
    </div>
  );
}

/** Règles communes aux trois offres Finch, sous la grille des forfaits. */
export function AssistantOfferNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center justify-center gap-2 text-center text-sm text-muted-foreground", className)}>
      <Mic className="size-4 text-primary" /> {NOM_ASSISTANT} comprend le wolof et le français. Recharge possible :{" "}
      {ASSISTANT_RECHARGE.credits} conversations pour {formatFCFA(ASSISTANT_RECHARGE.price)} · {ASSISTANT_TRIAL_CREDITS} conversations
      offertes pendant l&apos;essai
    </p>
  );
}

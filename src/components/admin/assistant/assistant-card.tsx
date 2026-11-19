import { Mic } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { libellePaiement, STATUTS_ASSISTANT, type EtatAssistant, type GenrePaiement } from "@/lib/domain/assistant/abonnement";
import { ASSISTANT_OFFERS, LICENSE_PACKS, type LicensePackId } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaiementAssistantVue } from "@/server/queries/assistant";
import { AnnulerPaiementAssistant, AssistantPaymentForm } from "./assistant-forms";

const methode = (m: string) => LICENSE_PAYMENT_METHODS[m as LicensePaymentMethod] ?? m;

/** Abonnement de Finch d'un commerce sous licence : état, saisie des paiements, historique. */
export function AssistantAdminCard({
  businessId,
  offre,
  etat,
  paiements,
}: {
  businessId: string;
  offre: LicensePackId;
  etat: EtatAssistant;
  paiements: PaiementAssistantVue[];
}) {
  const o = ASSISTANT_OFFERS[offre];
  const active = paiements.some((p) => p.kind === "activation");
  const choix: GenrePaiement[] = !active ? ["activation"] : etat.statut === "actif" || etat.statut === "epuise" ? ["mois", "recharge"] : ["mois"];
  const utilise = etat.total > 0 ? Math.round(((etat.total - etat.restants) / etat.total) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold">
          <Mic className="size-4 text-primary" /> Assistant Finch
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Offre {LICENSE_PACKS[offre].label}</p>
            <p className="font-semibold">
              {o.monthlyCredits} conversations · {formatFCFA(o.monthlyPrice)} / mois
            </p>
            <p className="text-xs text-muted-foreground">Activation {formatFCFA(o.activationPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">État</p>
            <p className="font-semibold">
              {STATUTS_ASSISTANT[etat.statut]}
              {etat.finLe && <span className="text-muted-foreground"> · jusqu&apos;au {formatDate(etat.finLe)}</span>}
            </p>
            {etat.mois && (
              <>
                <p className="text-xs text-muted-foreground">
                  {etat.restants} conversations restantes sur {etat.total}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", etat.restants <= 10 ? "bg-saffron" : "bg-primary")} style={{ width: `${utilise}%` }} />
                </div>
              </>
            )}
          </div>
        </div>
        <AssistantPaymentForm key={choix.join()} businessId={businessId} offre={offre} choix={choix} />
        {paiements.length > 0 && (
          <ul className="divide-y rounded-xl border text-sm">
            {paiements.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div>
                  <p className="font-medium">
                    {libellePaiement(p)} · {formatFCFA(p.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(p.paidAt)} · {methode(p.method)}
                    {p.recordedBy && ` · ${p.recordedBy}`}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                {p.annulable && <AnnulerPaiementAssistant paymentId={p.id} />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

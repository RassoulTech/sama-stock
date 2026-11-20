import { MessageCircle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LICENSE_PAYMENT_METHODS, type LicensePaymentMethod } from "@/lib/domain/admin";
import { ficheAssistant, libellePaiement, STATUTS_ASSISTANT, texteCredits, type EtatAssistant } from "@/lib/domain/assistant/abonnement";
import { NOM_ASSISTANT } from "@/lib/domain/assistant/nom";
import { ASSISTANT_OFFERS } from "@/lib/domain/plans";
import { formatDate, formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { waLink } from "@/lib/whatsapp";
import type { PaiementAssistantVue } from "@/server/queries/assistant";

/** Abonnement de Finch vu par le propriétaire : état, conversations restantes, paiements, contact pour payer. */
export function AssistantCard({
  etat,
  paiements,
  boutique,
  support,
}: {
  etat: EtatAssistant;
  paiements: PaiementAssistantVue[];
  boutique: string;
  support: string | null;
}) {
  const fiche = ficheAssistant(etat, { boutique, peutPayer: true, support });
  const offre = etat.offre ? ASSISTANT_OFFERS[etat.offre] : null;
  const contact = fiche
    ? { bouton: fiche.bouton, lien: fiche.lien }
    : etat.statut === "actif" && support
      ? { bouton: "Renouveler ou recharger", lien: waLink(support, `Bonjour, je veux renouveler ou recharger ${NOM_ASSISTANT} pour ${boutique}.`) }
      : null;
  const utilise = etat.total > 0 ? Math.round(((etat.total - etat.restants) / etat.total) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold">
          <Mic className="size-4 text-primary" /> Assistant {NOM_ASSISTANT}
          <span className="ml-auto text-sm font-normal text-muted-foreground">{STATUTS_ASSISTANT[etat.statut]}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fiche && <p className="text-sm text-muted-foreground">{fiche.texte}</p>}
        {(etat.statut === "essai" || (etat.mois && (etat.statut === "actif" || etat.statut === "epuise"))) && (
          <div>
            <p className="text-sm font-medium">
              {texteCredits(etat.restants, etat.statut === "essai").texte}
              {etat.statut !== "essai" && etat.finLe && <span className="text-muted-foreground"> · jusqu&apos;au {formatDate(etat.finLe)}</span>}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", etat.restants <= 10 ? "bg-saffron" : "bg-primary")} style={{ width: `${utilise}%` }} />
            </div>
          </div>
        )}
        {offre && etat.statut === "actif" && (
          <p className="text-xs text-muted-foreground">
            {offre.monthlyCredits} conversations par mois pour {formatFCFA(offre.monthlyPrice)}. Les conversations non utilisées ne passent pas au mois suivant.
          </p>
        )}
        {contact?.lien && contact.bouton && (
          <Button asChild>
            <a href={contact.lien} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> {contact.bouton}
            </a>
          </Button>
        )}
        {paiements.length > 0 && (
          <ul className="divide-y rounded-xl border text-sm">
            {paiements.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {libellePaiement(p)} <span className="text-muted-foreground">· {formatDate(p.paidAt)}</span>
                </span>
                <span className="text-muted-foreground">
                  {formatFCFA(p.amount)} · {LICENSE_PAYMENT_METHODS[p.method as LicensePaymentMethod] ?? p.method}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

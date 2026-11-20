import type { Metadata } from "next";
import { AssistantCard, AssistantCardGerant } from "@/components/billing/assistant-card";
import { BuyLicence } from "@/components/billing/buy-licence";
import { LicenseView } from "@/components/billing/license-view";
import { etatAssistant } from "@/lib/domain/assistant/abonnement";
import { LEGAL } from "@/lib/legal";
import { requireContext } from "@/server/context";
import { moisDuCommerce, paiementsDuCommerce } from "@/server/queries/assistant";
import { activeSaleFor, getLicenseSale } from "@/server/queries/licences";

export const metadata: Metadata = { title: "Ma licence" };

/**
 * Licence achetée : « Votre application » (maintenance, paiements). Pendant l'essai : les licences à acheter.
 * Dans les deux cas, l'abonnement de l'assistant Finch en dessous.
 * Les notifications de Finch mènent ici, pour le propriétaire comme pour les gérants : un gérant n'est donc pas renvoyé
 * au tableau de bord, il voit où en est Finch et qu'il faut prévenir le propriétaire (ni prix ni paiements).
 */
export default async function LicencePage() {
  const ctx = await requireContext();
  if (!ctx.can("billing.manage")) {
    const etat = etatAssistant({ isDemo: ctx.business.isDemo, plan: ctx.plan, mois: await moisDuCommerce(ctx.business.id) });
    return <AssistantCardGerant etat={etat} />;
  }
  const [mois, paiements] = await Promise.all([moisDuCommerce(ctx.business.id), paiementsDuCommerce(ctx.business.id)]);
  const etat = etatAssistant({ isDemo: ctx.business.isDemo, plan: ctx.plan, mois });
  const finch = <AssistantCard etat={etat} paiements={paiements} boutique={ctx.business.name} support={LEGAL.whatsapp} />;
  if (ctx.plan.license) {
    const sale = await activeSaleFor(ctx.business.id);
    const detail = sale ? await getLicenseSale(sale.id) : null;
    return (
      <>
        <LicenseView
          detail={detail}
          businessName={ctx.business.name}
          support={LEGAL.whatsapp}
          current={{ pack: ctx.plan.license, maintenanceEndsAt: ctx.business.maintenanceEndsAt }}
        />
        <div className="mt-5">{finch}</div>
      </>
    );
  }
  return (
    <>
      <BuyLicence plan={ctx.plan} businessName={ctx.business.name} />
      {etat.statut !== "indisponible" && <div className="mt-5">{finch}</div>}
    </>
  );
}

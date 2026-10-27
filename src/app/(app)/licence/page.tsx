import type { Metadata } from "next";
import { BuyLicence } from "@/components/billing/buy-licence";
import { LicenseView } from "@/components/billing/license-view";
import { LEGAL } from "@/lib/legal";
import { requireContext } from "@/server/context";
import { activeSaleFor, getLicenseSale } from "@/server/queries/licences";

export const metadata: Metadata = { title: "Ma licence" };

/** Licence achetée : « Votre application » (maintenance, paiements). Pendant l'essai : les licences à acheter. */
export default async function LicencePage() {
  const ctx = await requireContext("billing.manage");
  if (ctx.plan.license) {
    const sale = await activeSaleFor(ctx.business.id);
    const detail = sale ? await getLicenseSale(sale.id) : null;
    return (
      <LicenseView
        detail={detail}
        businessName={ctx.business.name}
        support={LEGAL.whatsapp}
        current={{ pack: ctx.plan.license, maintenanceEndsAt: ctx.business.maintenanceEndsAt }}
      />
    );
  }
  return <BuyLicence plan={ctx.plan} businessName={ctx.business.name} />;
}

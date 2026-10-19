import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { BusinessForm, LocationsManager, ModulesForm } from "@/components/settings/settings-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  const ctx = await requireContext("settings.manage");
  const disabled = ctx.plan.readOnly;
  const max = ctx.plan.limits.maxLocations;

  return (
    <>
      <PageHeader title="Paramètres" description="Les informations de votre commerce, reprises sur les reçus." />
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="font-bold">Mon commerce</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessForm business={ctx.business} disabled={disabled} />
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-bold">Modules</CardTitle>
              <p className="text-sm text-muted-foreground">Activez seulement ce dont vous avez besoin.</p>
            </CardHeader>
            <CardContent>
              <ModulesForm modulePos={ctx.business.modulePos} moduleOrders={ctx.business.moduleOrders} disabled={disabled} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-bold">Boutiques et dépôts</CardTitle>
            </CardHeader>
            <CardContent>
              <LocationsManager
                locations={ctx.locations.map((l) => ({ id: l.id, name: l.name, kind: l.kind }))}
                max={max}
                disabled={disabled}
                upgradeHint={
                  ctx.plan.plan !== "business"
                    ? "Plusieurs boutiques ou dépôts (jusqu'à 3), avec transferts de stock, sont disponibles avec la formule Business."
                    : null
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

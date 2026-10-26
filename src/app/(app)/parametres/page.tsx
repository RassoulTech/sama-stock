import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { BusinessForm, DocumentSettingsForm, LocationsManager, ModulesForm } from "@/components/settings/settings-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireContext } from "@/server/context";
import { and, eq } from "drizzle-orm";
import { BrandColorForm, CreatePasswordForm, PasswordForm } from "@/components/settings/account-settings";
import { db } from "@/db";
import { account } from "@/db/schema";

export const metadata: Metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  const ctx = await requireContext("settings.manage");
  const disabled = ctx.plan.readOnly;
  const max = ctx.plan.limits.maxLocations;
  // Compte e-mail : changer le mot de passe ; compte créé avec Google : en créer un
  const [credential] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, "credential")));
  const upgradeHint = ctx.plan.license
    ? ctx.plan.license !== "business"
      ? "Plusieurs boutiques ou dépôts sont inclus dans la licence Business : contactez Sama Stock."
      : null
    : ctx.plan.plan !== "business"
      ? "Plusieurs boutiques ou dépôts (jusqu'à 3), avec transferts de stock, sont disponibles avec la formule Business."
      : null;

  return (
    <>
      <PageHeader title="Paramètres" description="Les informations de votre commerce, reprises sur les reçus, devis et factures." />
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Mon commerce</CardTitle>
            </CardHeader>
            <CardContent>
              <BusinessForm business={ctx.business} disabled={disabled} />
            </CardContent>
          </Card>
          <Card id="documents">
            <CardHeader>
              <CardTitle className="font-semibold">Vos devis et factures</CardTitle>
              <p className="text-sm text-muted-foreground">Ces informations sont imprimées sur chaque devis et chaque facture.</p>
            </CardHeader>
            <CardContent>
              <DocumentSettingsForm business={ctx.business} disabled={disabled} />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Modules</CardTitle>
              <p className="text-sm text-muted-foreground">Activez seulement ce dont vous avez besoin.</p>
            </CardHeader>
            <CardContent>
              <ModulesForm modulePos={ctx.business.modulePos} moduleOrders={ctx.business.moduleOrders} disabled={disabled} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Boutiques et dépôts</CardTitle>
            </CardHeader>
            <CardContent>
              <LocationsManager
                locations={ctx.locations.map((l) => ({ id: l.id, name: l.name, kind: l.kind }))}
                max={max}
                disabled={disabled}
                upgradeHint={upgradeHint}
              />
            </CardContent>
          </Card>
          {ctx.plan.license && (
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold">Couleur de votre application</CardTitle>
                <p className="text-sm text-muted-foreground">Elle s&apos;applique au menu, aux boutons et aux graphiques. Votre logo se change dans « Mon commerce ».</p>
              </CardHeader>
              <CardContent>
                <BrandColorForm color={ctx.business.brandColor} disabled={disabled} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Mon mot de passe</CardTitle>
            </CardHeader>
            <CardContent>{credential ? <PasswordForm /> : <CreatePasswordForm email={ctx.user.email} />}</CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { PageHeader } from "@/components/shared/page-header";
import { CreatePasswordForm, PasswordForm } from "@/components/settings/account-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { account } from "@/db/schema";
import { receivesNotifications } from "@/lib/domain/notifications";
import { isStaffEmail } from "@/lib/domain/staff-pin";
import { requireContext } from "@/server/context";
import { pushPublicKey } from "@/server/push";
import { memberNotifySettings } from "@/server/queries/notifications";

export const metadata: Metadata = { title: "Mon compte" };

/** Accessible à tous (employés compris) : changer le mot de passe provisoire reçu du propriétaire. */
export default async function MonComptePage() {
  const ctx = await requireContext();
  const [credential] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, ctx.user.id), eq(account.providerId, "credential")));
  const notifications = receivesNotifications(ctx.role) ? (
    <Card id="notifications" className="mt-5 max-w-2xl scroll-mt-20">
      <CardHeader>
        <CardTitle className="font-semibold">Notifications</CardTitle>
        <p className="text-sm text-muted-foreground">Ventes, commandes et alertes de stock de {ctx.business.name}, avec un son.</p>
      </CardHeader>
      <CardContent>
        <NotificationSettings publicKey={pushPublicKey()} prefs={(await memberNotifySettings(ctx)).prefs} />
      </CardContent>
    </Card>
  ) : null;

  // Employé sans e-mail : il se connecte avec son code PIN, géré par le propriétaire
  if (isStaffEmail(ctx.user.email)) {
    return (
      <>
        <PageHeader title="Mon compte" description={ctx.user.name} />
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="font-semibold">Mon code PIN</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Vous ouvrez votre session avec votre code PIN sur l&apos;appareil de la boutique. Pour le changer ou si vous l&apos;avez oublié,
            demandez au propriétaire : il vous en crée un nouveau depuis la page Équipe.
          </CardContent>
        </Card>
        {notifications}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Mon compte" description={`${ctx.user.name} · ${ctx.user.email}`} />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="font-semibold">Mon mot de passe</CardTitle>
        </CardHeader>
        <CardContent>{credential ? <PasswordForm /> : <CreatePasswordForm email={ctx.user.email} />}</CardContent>
      </Card>
      {notifications}
    </>
  );
}

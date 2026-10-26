import { Clock, KeySquare, ShieldCheck, Smartphone, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PlanUsage } from "@/components/shared/plan-usage";
import { StatusPill } from "@/components/shared/stock-badge";
import { ActivateDeviceButton, AddEmployeeDialog, PinButton, RevokeDeviceButton } from "@/components/team/staff-components";
import { InvitationActions, MemberRoleSelect, RemoveMemberButton, ResetMemberPasswordButton } from "@/components/team/team-components";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { isRole, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/lib/domain/permissions";
import { canAdd } from "@/lib/domain/plans";
import { isLocked, isStaffEmail } from "@/lib/domain/staff-pin";
import { requireContext } from "@/server/context";
import { employeeCount, listTeam } from "@/server/queries/team";
import { listDevices, readDevice } from "@/server/services/devices";

export const metadata: Metadata = { title: "Équipe" };

export default async function EquipePage() {
  const ctx = await requireContext("team.manage");
  const [{ team, pending }, used, devices, here] = await Promise.all([
    listTeam(ctx.business.id),
    employeeCount(ctx.business.id),
    listDevices(ctx.business.id),
    readDevice(),
  ]);
  const max = ctx.plan.limits.maxEmployees;
  const now = new Date();
  const thisDevice = here?.businessId === ctx.business.id ? here : null;
  const shopPath = ctx.business.slug ? `/b/${ctx.business.slug}` : null;

  let disabledReason: string | undefined;
  if (ctx.plan.readOnly) disabledReason = "Votre compte est en consultation seule.";
  else if (max === 0) disabledReason = "Votre formule ne comprend pas d'employés : passez à une formule avec équipe.";
  else if (!canAdd(max, used)) disabledReason = `Limite de ${max} employés atteinte.`;

  return (
    <>
      <PageHeader
        title="Équipe"
        description="Ajoutez vos employés : chacun ouvre sa session avec son code PIN sur l'appareil de la boutique."
        actions={<AddEmployeeDialog disabledReason={disabledReason} />}
      />

      {max === 0 ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/70 p-4 text-sm text-accent-foreground">
          <span>Votre formule est réservée au propriétaire. Les formules avec équipe permettent d&apos;ajouter des employés.</span>
          <Link href="/abonnement" className="font-semibold text-primary hover:underline">
            Voir les formules
          </Link>
        </div>
      ) : (
        <div className="mb-5">
          <PlanUsage label="employés" used={used} limit={max} showUpgrade />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-semibold">
                <Users className="size-4 text-primary" /> Membres ({team.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {team.map((m) => {
                  const pinOnly = isStaffEmail(m.email);
                  const locked = isLocked(m.pinLockedUntil, now);
                  const self = m.userId === ctx.user.id;
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-accent font-semibold text-accent-foreground">{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 truncate font-semibold">
                          {m.name} {self && <span className="font-normal text-muted-foreground">(vous)</span>}
                          {locked && <StatusPill tone="red">Bloqué (codes faux)</StatusPill>}
                        </p>
                        <p className="flex flex-wrap items-center gap-1.5 truncate text-xs text-muted-foreground">
                          {pinOnly ? (
                            <>
                              <KeySquare className="size-3.5" /> Se connecte avec son code PIN
                            </>
                          ) : (
                            <>
                              {m.email}
                              {m.hasPin && " · code PIN"}
                            </>
                          )}
                          <span>· depuis le {formatDate(m.createdAt)}</span>
                        </p>
                      </div>
                      {isRole(m.role) && <MemberRoleSelect memberId={m.id} role={m.role} disabled={ctx.plan.readOnly} />}
                      <PinButton memberId={m.id} name={m.name} hasPin={m.hasPin} self={self} />
                      {!pinOnly && m.role !== "owner" && !self && <ResetMemberPasswordButton memberId={m.id} name={m.name} />}
                      {m.role !== "owner" && <RemoveMemberButton memberId={m.id} name={m.name} />}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-semibold">
                <Smartphone className="size-4 text-primary" /> Appareils de la boutique
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Les employés tapent leur code seulement sur ces appareils
                {shopPath && (
                  <>
                    , sur la page{" "}
                    <Link href={shopPath} className="font-medium text-primary hover:underline">
                      {shopPath}
                    </Link>
                  </>
                )}
                .
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun appareil activé pour l&apos;instant.</p>
              ) : (
                <ul className="divide-y">
                  {devices.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-medium">
                          {d.name} {thisDevice?.id === d.id && <StatusPill tone="green">Cet appareil</StatusPill>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Activé le {formatDate(d.createdAt)}
                          {d.createdByName && <> par {d.createdByName}</>}
                          {d.lastSeenAt && <> · dernière connexion {formatDateTime(d.lastSeenAt)}</>}
                        </p>
                      </div>
                      <RevokeDeviceButton deviceId={d.id} name={d.name} />
                    </li>
                  ))}
                </ul>
              )}
              {!thisDevice && !ctx.plan.readOnly && <ActivateDeviceButton shopPath={shopPath} />}
            </CardContent>
          </Card>

          {pending.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-semibold">
                  <Clock className="size-4 text-warning dark:text-saffron" /> Invitations envoyées avant les codes PIN
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {pending.map((inv) => {
                    const expired = inv.expiresAt < now;
                    const roleLabel = isRole(inv.role) ? ROLE_LABELS[inv.role] : inv.role;
                    return (
                      <li key={inv.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">
                            {inv.name} <StatusPill tone="gray">{roleLabel}</StatusPill>
                            {expired && <StatusPill tone="red">Expirée</StatusPill>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {inv.email} · {expired ? "a expiré" : "expire"} le {formatDate(inv.expiresAt)}
                          </p>
                        </div>
                        {!expired && (
                          <InvitationActions id={inv.id} token={inv.token} name={inv.name} roleLabel={roleLabel} businessName={ctx.business.name} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4 text-primary" /> Les rôles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4 text-sm">
              {ROLES.map((r) => (
                <div key={r}>
                  <dt className="font-semibold">{ROLE_LABELS[r]}</dt>
                  <dd className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

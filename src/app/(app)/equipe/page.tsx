import { Clock, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PlanUsage } from "@/components/shared/plan-usage";
import { StatusPill } from "@/components/shared/stock-badge";
import {
  InvitationActions,
  InviteDialog,
  MemberRoleSelect,
  RemoveMemberButton,
} from "@/components/team/team-components";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, initials } from "@/lib/format";
import { isRole, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/lib/domain/permissions";
import { canAdd } from "@/lib/domain/plans";
import { requireContext } from "@/server/context";
import { employeeCount, listTeam } from "@/server/queries/team";

export const metadata: Metadata = { title: "Équipe" };

export default async function EquipePage() {
  const ctx = await requireContext("team.manage");
  const [{ team, pending }, used] = await Promise.all([listTeam(ctx.business.id), employeeCount(ctx.business.id)]);
  const max = ctx.plan.limits.maxEmployees;
  const now = new Date();

  let disabledReason: string | undefined;
  if (ctx.plan.readOnly) disabledReason = "Votre compte est en consultation seule.";
  else if (max === 0) disabledReason = "L'essai ne permet pas d'inviter d'employés : passez à la formule Pro ou Business.";
  else if (!canAdd(max, used)) disabledReason = `Limite de ${max} employés atteinte : passez à la formule Business.`;

  return (
    <>
      <PageHeader
        title="Équipe"
        description="Invitez vos employés et choisissez ce qu'ils peuvent voir et faire."
        actions={<InviteDialog businessName={ctx.business.name} disabledReason={disabledReason} />}
      />

      {max === 0 ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/70 p-4 text-sm text-accent-foreground">
          <span>L&apos;essai gratuit est réservé au propriétaire. Avec Pro, invitez jusqu&apos;à 3 employés.</span>
          <Link href="/abonnement" className="font-semibold text-primary hover:underline">
            Voir les formules
          </Link>
        </div>
      ) : (
        <div className="mb-5">
          <PlanUsage label="employés (invitations comprises)" used={used} limit={max} showUpgrade />
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
                {team.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-accent font-semibold text-accent-foreground">{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {m.name} {m.userId === ctx.user.id && <span className="font-normal text-muted-foreground">(vous)</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email} · depuis le {formatDate(m.createdAt)}
                      </p>
                    </div>
                    {isRole(m.role) && <MemberRoleSelect memberId={m.id} role={m.role} disabled={ctx.plan.readOnly} />}
                    {m.role !== "owner" && <RemoveMemberButton memberId={m.id} name={m.name} />}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {pending.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-semibold">
                  <Clock className="size-4 text-warning dark:text-saffron" /> Invitations en attente
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
                          <InvitationActions
                            id={inv.id}
                            token={inv.token}
                            name={inv.name}
                            roleLabel={roleLabel}
                            businessName={ctx.business.name}
                          />
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

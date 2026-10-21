import { CheckCircle2, Circle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminActions } from "@/components/admin/admin-actions";
import { AuditList } from "@/components/admin/audit-list";
import { LicenseCard } from "@/components/admin/licence/license-card";
import {
  BrandForm,
  LicenseAccess,
  SellLicenseForm,
} from "@/components/admin/licence/license-forms";
import { BarChart } from "@/components/admin/bar-chart";
import { BusinessNotes } from "@/components/admin/business-notes";
import {
  ContactButtons,
  HealthPill,
  relativeDay,
} from "@/components/admin/contact-buttons";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/shared/stock-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminReminderMessage, planBadgeText } from "@/lib/domain/admin";
import { isRole, ROLE_LABELS } from "@/lib/domain/permissions";
import {
  PERIOD_DAYS,
  PLAN_STATUS_LABELS,
  PLAN_STATUS_TONES,
  PLANS,
  TRIAL_DAYS,
} from "@/lib/domain/plans";
import { ACTIVITIES, type Activity } from "@/lib/domain/sales";
import { formatDate, formatFCFA, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getBusinessForAdmin,
  SUBSCRIPTION_METHOD_LABELS,
} from "@/server/queries/admin";
import {
  activeSaleFor,
  balanceOf,
  getLicenseSale,
} from "@/server/queries/licences";

export const metadata: Metadata = { title: "Fiche commerce" };

const DAY = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export default async function AdminBusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getBusinessForAdmin(id);
  if (!data) notFound();
  const {
    business: b,
    history,
    members,
    notes,
    audit,
    locations,
    daily,
    brand,
  } = data;
  const s = b.state;
  const activeSale = s.license ? await activeSaleFor(id) : null;
  const licence = activeSale ? await getLicenseSale(activeSale.id) : null;

  const span = s.plan === "trial" ? TRIAL_DAYS : PERIOD_DAYS;
  const remaining =
    s.status === "active" || s.status === "trialing"
      ? Math.min(100, Math.round((s.daysLeft / span) * 100))
      : 0;
  const steps = [
    { label: "Compte créé", done: true },
    { label: "Premier produit ajouté", done: b.productCount > 0 },
    { label: "Première vente", done: b.saleCount > 0 },
    { label: "Équipe invitée", done: b.memberCount > 1 },
    s.license
      ? {
          label: "Licence soldée",
          done: licence ? balanceOf(licence.sale) === 0 : false,
        }
      : { label: "Abonnement payé", done: b.paidTotal > 0 },
  ];
  const done = steps.filter((x) => x.done).length;
  const chart = daily.map((d, i) => ({
    key: d.day,
    label: DAY.format(new Date(`${d.day}T00:00:00Z`)),
    value: d.total,
    tick:
      (i % 7 === 0 && i < daily.length - 4) || i === daily.length - 1
        ? DAY.format(new Date(`${d.day}T00:00:00Z`))
        : undefined,
  }));
  const tiles = [
    { label: "Produits", value: String(b.productCount) },
    { label: "Ventes (30 j)", value: String(b.sales30) },
    { label: "Vendu (30 j)", value: formatFCFA(b.revenue30) },
    { label: "Membres", value: String(b.memberCount) },
    { label: "Boutiques", value: String(b.locationCount) },
    { label: "Dernière activité", value: relativeDay(b.lastActivity) },
  ];

  return (
    <>
      <PageHeader
        backHref="/admin/commerces"
        title={b.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={PLAN_STATUS_TONES[s.status]}>
              {planBadgeText(s.label, s.status, PLAN_STATUS_LABELS[s.status])}
            </StatusPill>
            <HealthPill health={b.health} />
            <span>
              {ACTIVITIES[b.activity as Activity] ?? b.activity}
              {b.city && <> · {b.city}</>}
            </span>
          </span>
        }
        actions={
          <ContactButtons
            phone={b.phone}
            email={b.ownerEmail}
            message={adminReminderMessage({
              ownerName: b.ownerName,
              businessName: b.name,
              status: s.status,
              daysLeft: s.daysLeft,
            })}
          />
        }
      />

      <dl className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border bg-card px-3.5 py-3">
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd className="num mt-1 truncate text-lg font-semibold tracking-[-0.02em]">
              {t.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">
                Montant vendu par jour (30 derniers jours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                data={chart}
                format={formatFCFA}
                label="Montant des ventes par jour"
              />
            </CardContent>
          </Card>

          {licence ? (
            <LicenseCard detail={licence} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold">Abonnement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Formule</p>
                    <p className="font-semibold">
                      {s.label}
                      {s.plan !== "trial" && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatFCFA(PLANS[s.plan].price)} / mois
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Fin de période
                    </p>
                    <p className="font-semibold">
                      {s.endsAt ? formatDate(s.endsAt) : "—"}
                      {(s.status === "active" || s.status === "trialing") && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {s.daysLeft} j
                        </span>
                      )}
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          s.daysLeft <= 3 ? "bg-saffron" : "bg-primary",
                        )}
                        style={{ width: `${remaining}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total payé</p>
                    <p className="num font-semibold">
                      {formatFCFA(b.paidTotal)}
                    </p>
                  </div>
                </div>
                <AdminActions
                  businessId={b.id}
                  plan={s.plan}
                  suspended={s.status === "suspended"}
                />
              </CardContent>
            </Card>
          )}

          {!s.license && (
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold">
                  Vendre l&apos;application
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SellLicenseForm businessId={b.id} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">
                Historique d&apos;abonnement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun paiement ni changement de formule pour l&apos;instant.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="flex justify-between gap-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">
                          {PLANS[h.plan as keyof typeof PLANS]?.label ?? h.plan}{" "}
                          · {SUBSCRIPTION_METHOD_LABELS[h.method] ?? h.method}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(h.createdAt)} → fin le{" "}
                          {h.periodEnd ? formatDate(h.periodEnd) : "—"}
                          {h.note && <> · {h.note}</>}
                        </span>
                      </span>
                      <span className="num shrink-0 font-semibold">
                        {formatFCFA(h.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 font-semibold">
                Premiers pas
                <span className="num text-sm font-medium text-muted-foreground">
                  {done}/{steps.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(done / steps.length) * 100}%` }}
                />
              </div>
              <ul className="space-y-2 text-sm">
                {steps.map((x) => (
                  <li
                    key={x.label}
                    className={cn(
                      "flex items-center gap-2",
                      !x.done && "text-muted-foreground",
                    )}
                  >
                    {x.done ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : (
                      <Circle className="size-4" />
                    )}
                    {x.label}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Propriétaire", b.ownerName ?? "—"],
                  ["E-mail", b.ownerEmail ?? "—"],
                  ["Téléphone", b.phone ? formatPhone(b.phone) : "—"],
                  ["Ville", b.city ?? "—"],
                  ["Boutiques", locations.join(", ") || "—"],
                  ["Inscrit le", formatDate(b.createdAt)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 text-right font-medium break-words">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {s.license && (
            <Card id="personnalisation">
              <CardHeader>
                <CardTitle className="font-semibold">Son application</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Logo et couleur : dans son menu, sur ses reçus.
                </p>
              </CardHeader>
              <CardContent>
                <BrandForm
                  businessId={b.id}
                  color={brand.color}
                  logo={brand.logo}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">
                Accès du propriétaire
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LicenseAccess
                businessId={b.id}
                businessName={b.name}
                phone={b.phone}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">
                Équipe ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {m.name || m.email}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.email} · vu {relativeDay(m.last_seen)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium">
                      {isRole(m.role) ? ROLE_LABELS[m.role] : m.role}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Notes internes</CardTitle>
            </CardHeader>
            <CardContent>
              <BusinessNotes
                businessId={b.id}
                notes={notes.map((n) => ({
                  id: n.id,
                  authorName: n.authorName,
                  body: n.body,
                  createdAt: n.createdAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">
                Journal de ce commerce
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditList entries={audit} hideBusiness compact />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

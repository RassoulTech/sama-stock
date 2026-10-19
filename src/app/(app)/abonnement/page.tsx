import { eq, desc } from "drizzle-orm";
import { Check, CreditCard, Info, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { subscriptionEvents } from "@/db/schema";
import { formatDate, formatFCFA } from "@/lib/format";
import { formatLimit, PAID_PLANS, PLAN_STATUS_LABELS, PLANS, type PlanDefinition } from "@/lib/domain/plans";
import { cn } from "@/lib/utils";
import { simulatePayment } from "@/server/actions/billing";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Abonnement" };

function features(p: PlanDefinition) {
  return [
    `${formatLimit(p.maxProducts)} produits`,
    p.maxEmployees === 0 ? "Propriétaire seul" : `${formatLimit(p.maxEmployees)} employés`,
    `${p.maxLocations} boutique${p.maxLocations > 1 ? "s ou dépôts" : ""}`,
    "Caisse, commandes en ligne, crédits clients",
    "Inventaire, pertes, fournisseurs",
    ...(p.advancedReports ? ["Rapports avancés (bénéfices, meilleurs produits…)"] : []),
  ];
}

export default async function AbonnementPage() {
  const ctx = await requireContext("billing.manage");
  const history = await db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.businessId, ctx.business.id))
    .orderBy(desc(subscriptionEvents.createdAt))
    .limit(24);
  const plan = ctx.plan;
  const statusTone = plan.status === "active" || plan.status === "trialing" ? "green" : "red";

  return (
    <>
      <PageHeader title="Abonnement" description="Choisissez la formule adaptée à votre commerce." />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-accent text-primary">
              <CreditCard className="size-6" />
            </span>
            <div>
              <p className="flex items-center gap-2 text-lg font-extrabold">
                Formule {plan.label} <StatusPill tone={statusTone}>{PLAN_STATUS_LABELS[plan.status]}</StatusPill>
              </p>
              <p className="text-sm text-muted-foreground">
                {plan.endsAt
                  ? plan.status === "expired"
                    ? `Terminée le ${formatDate(plan.endsAt)} — compte en consultation seule`
                    : `${plan.status === "trialing" ? "Essai" : "Période"} valable jusqu'au ${formatDate(plan.endsAt)} (${plan.daysLeft} jour${plan.daysLeft > 1 ? "s" : ""})`
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-start gap-2 rounded-2xl bg-saffron/15 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-warning dark:text-saffron" />
        <span>
          <strong>Version de démonstration :</strong> le paiement est simulé. Le paiement réel par Wave ou Orange Money sera
          activé lors de la mise en production.
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {[PLANS.trial, ...PAID_PLANS].map((p) => {
          const current = plan.plan === p.id;
          const featured = p.id === "business";
          return (
            <Card
              key={p.id}
              className={cn("relative", featured && "ring-2 ring-primary", current && "bg-accent/40")}
            >
              {featured && (
                <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-saffron px-2.5 py-0.5 text-xs font-bold text-saffron-foreground">
                  <Sparkles className="size-3" /> Le plus complet
                </span>
              )}
              <CardHeader>
                <CardTitle className="text-lg font-extrabold">{p.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
              </CardHeader>
              <CardContent className="flex h-full flex-col gap-5">
                <p>
                  <span className="num text-3xl font-extrabold">{formatFCFA(p.price)}</span>
                  <span className="text-sm text-muted-foreground">{p.id === "trial" ? " · 14 jours" : " / mois"}</span>
                </p>
                <ul className="space-y-2 text-sm">
                  {features(p).map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {p.id === "trial" ? (
                    <p className="text-center text-xs text-muted-foreground">Offert à l&apos;inscription</p>
                  ) : (
                    <ConfirmAction
                      trigger={
                        <Button className="w-full" variant={featured ? "default" : "outline"}>
                          {current && plan.status === "active" ? "Renouveler" : current ? "Réactiver" : `Passer à ${p.label}`} ·{" "}
                          {formatFCFA(p.price)}
                        </Button>
                      }
                      title={`Payer ${formatFCFA(p.price)} pour la formule ${p.label} ?`}
                      description="Simulation : aucun argent n'est débité. La formule est activée immédiatement pour 30 jours."
                      confirmLabel="Payer (simulation)"
                      successMessage={`Formule ${p.label} activée pour 30 jours`}
                      action={simulatePayment.bind(null, p.id)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-bold">Historique des paiements</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun paiement pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="font-semibold">Formule {PLANS[h.plan as keyof typeof PLANS]?.label ?? h.plan}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(h.createdAt)} · du {h.periodStart ? formatDate(h.periodStart) : "—"} au{" "}
                      {h.periodEnd ? formatDate(h.periodEnd) : "—"} · {h.method === "simulation" ? "Simulation" : h.method === "admin" ? "Administrateur" : h.method}
                    </span>
                  </span>
                  <span className="num font-semibold">{formatFCFA(h.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

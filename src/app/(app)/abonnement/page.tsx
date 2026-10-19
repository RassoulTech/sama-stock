import { desc, eq } from "drizzle-orm";
import { Banknote, Check, Clock, CreditCard, Info, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { CheckoutButton, RefreshCheckoutButton } from "@/components/billing/checkout-buttons";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { StatusPill } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { subscriptionEvents } from "@/db/schema";
import { formatDate, formatDateTime, formatFCFA } from "@/lib/format";
import { formatLimit, PAID_PLANS, PLAN_STATUS_LABELS, PLANS, type PlanDefinition } from "@/lib/domain/plans";
import { cn } from "@/lib/utils";
import { simulatePayment } from "@/server/actions/billing";
import { requireContext } from "@/server/context";
import { isPaymentSimulation, isSaspayEnabled } from "@/server/saspay";
import { listPendingCheckouts } from "@/server/services/subscription";

const METHOD_LABELS: Record<string, string> = {
  saspay: "Wave / Orange Money",
  simulation: "Simulation",
  admin: "Espèces (enregistré par l'équipe)",
};

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
  const pendingCheckouts = isSaspayEnabled ? await listPendingCheckouts(ctx.business.id) : [];
  const plan = ctx.plan;
  const statusTone = plan.status === "active" || plan.status === "trialing" ? "green" : "red";

  return (
    <>
      <PageHeader title="Abonnement" description="Choisissez la formule adaptée à votre commerce." />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-xl bg-accent text-primary">
              <CreditCard className="size-6" />
            </span>
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold">
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

      {pendingCheckouts.map((c) => (
        <div key={c.id} className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-warning dark:text-saffron" />
            <span>
              <strong>Paiement en attente</strong> — formule {PLANS[c.plan as keyof typeof PLANS]?.label ?? c.plan},{" "}
              {formatFCFA(c.amount)} ({formatDateTime(c.createdAt)}). Vous avez payé ? Vérifiez-le ici.
            </span>
          </span>
          <RefreshCheckoutButton checkoutId={c.id} />
        </div>
      ))}

      {isSaspayEnabled ? (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            <span>
              <strong>Paiement sécurisé</strong> par Wave ou Orange Money. Votre formule s&apos;active dès que le paiement est
              confirmé.
            </span>
          </span>
          <span className="flex items-center gap-2 text-xs font-medium">
            <PaymentLogo method="wave" className="size-7" /> Wave
            <PaymentLogo method="orange_money" className="ml-2 size-7" /> Orange Money
          </span>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-saffron/15 p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warning dark:text-saffron" />
          <span>
            {isPaymentSimulation ? (
              <>
                <strong>Version de démonstration :</strong> le paiement est simulé. Le paiement réel par Wave ou Orange
                Money s&apos;active dès que la clé SasPay est ajoutée.
              </>
            ) : (
              <>
                <strong>Paiement en ligne bientôt disponible</strong> (Wave, Orange Money).
              </>
            )}
          </span>
        </div>
      )}

      <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground">
        <Banknote className="mt-0.5 size-4 shrink-0" />
        Vous préférez payer en espèces ? Réglez auprès de l&apos;équipe Sama Stock : elle active votre formule depuis son
        espace d&apos;administration.
      </p>

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
                <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-saffron px-2.5 py-0.5 text-xs font-semibold text-saffron-foreground">
                  <Sparkles className="size-3" /> Le plus complet
                </span>
              )}
              <CardHeader>
                <CardTitle className="text-lg font-semibold">{p.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
              </CardHeader>
              <CardContent className="flex h-full flex-col gap-5">
                <p>
                  <span className="num text-3xl font-semibold">{formatFCFA(p.price)}</span>
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
                  ) : isSaspayEnabled ? (
                    <CheckoutButton
                      plan={p.id}
                      featured={featured}
                      label={`${current && plan.status === "active" ? "Renouveler" : current ? "Réactiver" : `Passer à ${p.label}`} · ${formatFCFA(p.price)}`}
                    />
                  ) : !isPaymentSimulation ? (
                    <Button className="w-full" variant="outline" disabled>
                      Bientôt disponible
                    </Button>
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
          <CardTitle className="font-semibold">Historique des paiements</CardTitle>
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
                      {h.periodEnd ? formatDate(h.periodEnd) : "—"} · {METHOD_LABELS[h.method] ?? h.method}
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

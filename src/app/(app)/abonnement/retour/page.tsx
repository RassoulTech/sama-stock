import { and, eq } from "drizzle-orm";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCheckoutButton } from "@/components/billing/checkout-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { subscriptionCheckouts } from "@/db/schema";
import { PLANS } from "@/lib/domain/plans";
import { formatFCFA } from "@/lib/format";
import { requireContext } from "@/server/context";
import { confirmCheckout, type CheckoutOutcome } from "@/server/services/subscription";

export const metadata: Metadata = { title: "Paiement" };

const VIEWS: Record<CheckoutOutcome, { icon: typeof Clock; tone: string; title: string; text: string }> = {
  paid: {
    icon: CheckCircle2,
    tone: "bg-success/10 text-success",
    title: "Paiement confirmé",
    text: "Merci ! Votre formule est active pour 30 jours.",
  },
  pending: {
    icon: Clock,
    tone: "bg-saffron/15 text-warning dark:text-saffron",
    title: "Paiement en cours de confirmation",
    text: "Wave ou Orange Money n'a pas encore confirmé. Patientez quelques secondes puis vérifiez à nouveau.",
  },
  failed: {
    icon: XCircle,
    tone: "bg-destructive/10 text-destructive",
    title: "Paiement non abouti",
    text: "Aucun montant n'a été validé. Vous pouvez réessayer depuis la page Abonnement.",
  },
};

export default async function RetourPaiementPage({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const ctx = await requireContext("billing.manage");
  const { paiement } = await searchParams;
  const [checkout] = paiement
    ? await db
        .select()
        .from(subscriptionCheckouts)
        .where(and(eq(subscriptionCheckouts.id, paiement), eq(subscriptionCheckouts.businessId, ctx.business.id)))
    : [];
  const outcome: CheckoutOutcome = checkout
    ? await confirmCheckout(checkout.id).catch((error) => {
        console.error("[saspay]", error);
        return "pending" as const;
      })
    : "failed";
  const view = VIEWS[outcome];
  const Icon = view.icon;

  return (
    <Card className="mx-auto mt-8 max-w-md">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <span className={`grid size-16 place-items-center rounded-full ${view.tone}`}>
          <Icon className="size-8" />
        </span>
        <h1 className="text-xl font-semibold">{view.title}</h1>
        {checkout && (
          <p className="num font-medium">
            Formule {PLANS[checkout.plan as keyof typeof PLANS]?.label ?? checkout.plan} · {formatFCFA(checkout.amount)}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{view.text}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {outcome === "pending" && checkout && <RefreshCheckoutButton checkoutId={checkout.id} />}
          <Button asChild variant={outcome === "paid" ? "default" : "outline"} size="sm">
            <Link href={outcome === "paid" ? "/tableau-de-bord" : "/abonnement"}>
              {outcome === "paid" ? "Aller au tableau de bord" : "Retour à l'abonnement"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

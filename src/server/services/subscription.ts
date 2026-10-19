import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { businesses, subscriptionCheckouts, subscriptionEvents } from "@/db/schema";
import { PERIOD_DAYS, type PlanId } from "@/lib/domain/plans";
import { getCheckoutStatus, verifyPayment } from "../saspay";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type PaidPlan = Exclude<PlanId, "trial">;
export type CheckoutOutcome = "paid" | "pending" | "failed";

const FAILED = new Set(["FAILED", "EXPIRED", "CANCELLED", "CANCELED"]);

/** Ajoute une période (30 jours par défaut) ; une même formule encore en cours est prolongée à partir de sa date de fin. */
export async function grantPeriod(
  tx: Tx,
  input: {
    businessId: string;
    plan: PaidPlan;
    amount: number;
    method: string;
    userId: string | null;
    days?: number;
    note?: string;
  },
) {
  const [business] = await tx
    .select({ plan: businesses.plan, periodEndsAt: businesses.periodEndsAt })
    .from(businesses)
    .where(eq(businesses.id, input.businessId))
    .for("update");
  const now = new Date();
  const extend = business.plan === input.plan && business.periodEndsAt && business.periodEndsAt > now;
  const start = extend ? business.periodEndsAt! : now;
  const end = new Date(start.getTime() + (input.days ?? PERIOD_DAYS) * 86_400_000);

  await tx.update(businesses).set({ plan: input.plan, periodEndsAt: end }).where(eq(businesses.id, input.businessId));
  await tx.insert(subscriptionEvents).values({
    businessId: input.businessId,
    plan: input.plan,
    amount: input.amount,
    periodStart: start,
    periodEnd: end,
    method: input.method,
    note: input.note,
    userId: input.userId,
  });
  return end;
}

/** Paiements en ligne encore en attente de confirmation (dernières 48 h). */
export function listPendingCheckouts(businessId?: string) {
  return db
    .select()
    .from(subscriptionCheckouts)
    .where(
      and(
        businessId ? eq(subscriptionCheckouts.businessId, businessId) : undefined,
        eq(subscriptionCheckouts.status, "pending"),
        gt(subscriptionCheckouts.createdAt, new Date(Date.now() - 48 * 3_600_000)),
      ),
    )
    .orderBy(desc(subscriptionCheckouts.createdAt))
    .limit(50);
}

/**
 * Revérifie un paiement auprès de SasPay et active la formule une seule fois.
 * Appelé au retour du client, depuis la notification SasPay ou par le bouton « Vérifier ».
 */
export async function confirmCheckout(checkoutId: string): Promise<CheckoutOutcome> {
  const [row] = await db.select().from(subscriptionCheckouts).where(eq(subscriptionCheckouts.id, checkoutId));
  if (!row) return "failed";
  if (row.status !== "pending") return row.status as CheckoutOutcome;

  const pendingRow = and(eq(subscriptionCheckouts.id, row.id), eq(subscriptionCheckouts.status, "pending"));
  const session = await getCheckoutStatus(row.sessionId);
  if (FAILED.has(session.status) || (session.transaction_status && FAILED.has(session.transaction_status))) {
    await db.update(subscriptionCheckouts).set({ status: "failed" }).where(pendingRow);
    return "failed";
  }
  if (session.status !== "PAID" || !session.transaction_id) return "pending";

  const payment = await verifyPayment(session.transaction_id);
  if (payment.status !== "SUCCESS") return "pending";
  // SasPay confirme le montant de base demandé ; le client, lui, a payé le prix de la formule (row.amount)
  if (payment.currency !== "XOF" || Number(payment.requested_amount) < (row.requestedAmount ?? row.amount)) {
    console.error("[saspay] montant inattendu", { checkoutId: row.id, transaction: payment.id });
    return "pending";
  }

  return db.transaction(async (tx): Promise<CheckoutOutcome> => {
    const claimed = await tx
      .update(subscriptionCheckouts)
      .set({ status: "paid", paidAt: new Date(), transactionId: payment.id })
      .where(pendingRow)
      .returning({ id: subscriptionCheckouts.id });
    // Déjà activé par un autre appel (retour du client et notification simultanés)
    if (claimed.length === 0) return "paid";
    await grantPeriod(tx, {
      businessId: row.businessId,
      plan: row.plan as PaidPlan,
      amount: row.amount,
      method: "saspay",
      userId: row.userId,
    });
    return "paid";
  });
}

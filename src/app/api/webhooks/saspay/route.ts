import { isValidWebhook } from "@/server/saspay";
import { confirmCheckout, listPendingCheckouts } from "@/server/services/subscription";

const WATCHED_EVENTS = new Set(["transaction.success", "transaction.failed", "transaction.cancelled"]);

/**
 * Notification SasPay. Elle ne suffit jamais à activer un abonnement :
 * on revérifie auprès de SasPay les paiements encore en attente des dernières 48 h.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const valid = isValidWebhook(raw, request.headers.get("x-webhook-signature"), request.headers.get("x-webhook-timestamp"));
  if (!valid) return Response.json({ error: "Signature invalide" }, { status: 401 });

  if (WATCHED_EVENTS.has(request.headers.get("x-webhook-event") ?? "")) {
    for (const { id } of await listPendingCheckouts()) {
      await confirmCheckout(id).catch((error) => console.error("[saspay webhook]", error));
    }
  }
  return Response.json({ received: true });
}

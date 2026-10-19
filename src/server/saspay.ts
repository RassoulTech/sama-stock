import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Client minimal de l'API SasPay (https://docs.saspay.me). La clé API ne quitte jamais le serveur.
const BASE_URL = "https://api.saspay.me/api/v1";
const WEBHOOK_TOLERANCE_SECONDS = 300;

export const isSaspayEnabled = Boolean(process.env.SASPAY_API_KEY);
/** Le paiement simulé n'existe que sur l'ordinateur local (jamais sur Vercel), tant que SasPay n'est pas branché. */
export const isPaymentSimulation = !isSaspayEnabled && !process.env.VERCEL;

export class SaspayError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(`SasPay a répondu ${status}`);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.SASPAY_API_KEY;
  if (!key) throw new Error("SASPAY_API_KEY manquante");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: unknown } | null;
  if (!res.ok || !body?.success || body.data === undefined) throw new SaspayError(res.status, body?.error);
  return body.data;
}

/** Montants : chaînes décimales, jamais de flottants (règle SasPay). */
const toAmount = (fcfa: number) => `${Math.round(fcfa)}.00`;

export function createCheckoutSession(input: {
  amount: number;
  description: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  metadata: Record<string, string>;
}) {
  return call<{ id: string; checkout_url: string; status: string }>("/checkout-sessions/", {
    method: "POST",
    body: JSON.stringify({
      amount: toAmount(input.amount),
      currency: "XOF",
      country: "SN",
      description: input.description,
      customer_email: input.customerEmail,
      customer_name: input.customerName,
      return_url: input.returnUrl,
      metadata: input.metadata,
      // Le client paie exactement le prix affiché ; les frais SasPay sont retirés du montant reçu par Sama Stock
      fee_charge_mode: "DEDUCTED",
    }),
  });
}

export function getCheckoutStatus(sessionId: string) {
  return call<{ status: string; transaction_id: string | null; transaction_status: string | null }>(
    `/checkout-sessions/${encodeURIComponent(sessionId)}/status/`,
  );
}

/** Revérifie l'état réel d'un paiement auprès de SasPay : seule source de vérité avant d'activer un accès. */
export function verifyPayment(transactionId: string) {
  return call<{ id: string; status: string; requested_amount: string; currency: string }>(
    `/payments/${encodeURIComponent(transactionId)}/verify/`,
  );
}

/** Signature HMAC-SHA256 de « horodatage.corps brut », horodatage de moins de 5 minutes. */
export function isValidWebhook(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

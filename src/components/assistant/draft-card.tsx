"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOfflineMode } from "@/components/offline/offline-provider";
import { Button } from "@/components/ui/button";
import type { Draft, DraftLine } from "@/lib/domain/assistant/drafts";
import { CHANNELS, PAYMENT_METHODS } from "@/lib/domain/sales";
import { formatFCFA, formatQty } from "@/lib/format";
import { recordCustomerPayment } from "@/server/actions/customers";
import { createOrder } from "@/server/actions/orders";
import { createSale } from "@/server/actions/sales";
import { createPurchase } from "@/server/actions/stock";

const TITLES: Record<Draft["action"], string> = {
  sale: "Vente",
  purchase: "Entrée de stock",
  order: "Commande",
  payment: "Paiement client",
};
const DONE: Record<Draft["action"], string> = {
  sale: "Vente enregistrée",
  purchase: "Entrée de stock enregistrée",
  order: "Commande enregistrée",
  payment: "Paiement enregistré",
};

/** Enregistre par l'action existante : mêmes droits, mêmes contrôles qu'à la main. */
function submit(draft: Draft, clientRef: string) {
  switch (draft.action) {
    case "sale":
      return createSale({ ...draft.payload, clientRef });
    case "purchase":
      return createPurchase(draft.payload);
    case "order":
      return createOrder(draft.payload);
    case "payment":
      return recordCustomerPayment(draft.payload);
  }
}

function Lines({ lines }: { lines: DraftLine[] }) {
  return (
    <ul className="space-y-1">
      {lines.map((l) => (
        <li key={l.productId} className="flex items-start justify-between gap-3 text-sm">
          <span>
            {formatQty(l.quantity, l.unit)} · {l.name}
            {l.short && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="size-3" /> Disponible : {formatQty(l.available, l.unit)}
              </span>
            )}
          </span>
          {l.lineTotal !== null && <span className="shrink-0 tabular-nums">{formatFCFA(l.lineTotal)}</span>}
        </li>
      ))}
    </ul>
  );
}

export function DraftCard({ draft }: { draft: Draft }) {
  const router = useRouter();
  const [clientRef] = useState(() => crypto.randomUUID());
  const offline = useOfflineMode();
  const [state, setState] = useState<"idle" | "saving" | "done" | "cancelled">("idle");
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    setState("saving");
    setError(null);
    const res = await submit(draft, clientRef).catch(() => ({ ok: false as const, error: "Pas de connexion : rien n'a été enregistré." }));
    if (!res.ok) {
      setState("idle");
      setError(res.error);
      return;
    }
    setState("done");
    void offline.refreshSnapshot(true);
    router.refresh();
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl border bg-card p-3 text-card-foreground">
      <p className="text-sm font-semibold">{TITLES[draft.action]} — à valider</p>
      {"lines" in draft && <Lines lines={draft.lines} />}
      <div className="space-y-0.5 text-sm text-muted-foreground">
        {draft.action === "sale" && (
          <p>
            {PAYMENT_METHODS[draft.paymentMethod]}
            {draft.customer ? ` · ${draft.customer.name}` : ""}
          </p>
        )}
        {draft.action === "purchase" && draft.supplier && <p>Fournisseur : {draft.supplier.name}</p>}
        {draft.action === "order" && (
          <p>
            {CHANNELS[draft.channel]} · {draft.customer.name}
            {draft.deliveryFee > 0 ? ` · livraison ${formatFCFA(draft.deliveryFee)}` : ""}
          </p>
        )}
        {draft.action === "payment" && (
          <p>
            {draft.customer.name} · {PAYMENT_METHODS[draft.method]}
          </p>
        )}
      </div>
      {draft.action === "payment" ? (
        <p className="text-base font-semibold tabular-nums">{formatFCFA(draft.amount)}</p>
      ) : (
        draft.total !== null && <p className="text-base font-semibold tabular-nums">Total : {formatFCFA(draft.total)}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {state === "done" ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <CheckCircle2 className="size-4" /> {DONE[draft.action]}
        </p>
      ) : state === "cancelled" ? (
        <p className="text-sm text-muted-foreground">Annulé : rien n&apos;a été enregistré.</p>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={state === "saving"} onClick={() => void validate()}>
            {state === "saving" ? "Enregistrement…" : "Valider"}
          </Button>
          <Button size="sm" variant="outline" disabled={state === "saving"} onClick={() => setState("cancelled")}>
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}

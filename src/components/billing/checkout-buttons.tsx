"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { Button } from "@/components/ui/button";
import { refreshCheckout, startCheckout } from "@/server/actions/billing";

/** Ouvre la page de paiement sécurisée SasPay, où le client choisit Wave ou Orange Money. */
export function CheckoutButton({ plan, label, featured }: { plan: string; label: string; featured: boolean }) {
  const [pending, start] = useTransition();

  return (
    <Button
      className="w-full"
      variant={featured ? "default" : "outline"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startCheckout(plan);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          window.location.assign(res.data.url);
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <span className="flex -space-x-1">
          <PaymentLogo method="wave" className="size-5 ring-2 ring-card" />
          <PaymentLogo method="orange_money" className="size-5 ring-2 ring-card" />
        </span>
      )}
      {label}
    </Button>
  );
}

export function RefreshCheckoutButton({ checkoutId }: { checkoutId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await refreshCheckout(checkoutId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Paiement confirmé, votre formule est active.");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Vérifier le paiement
    </Button>
  );
}

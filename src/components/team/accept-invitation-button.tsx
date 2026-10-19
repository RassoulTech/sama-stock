"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/server/actions/team";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <FormError message={error} />
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acceptInvitation(token);
            if (!res.ok) return setError(res.error);
            router.replace("/tableau-de-bord");
            router.refresh();
          })
        }
      >
        {pending && <Loader2 className="animate-spin" />}
        Rejoindre l&apos;équipe
      </Button>
    </div>
  );
}

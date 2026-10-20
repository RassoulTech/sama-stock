"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enterDemo } from "@/server/actions/demo";

/** Ouvre la démo d'une formule. La première visite du jour prépare la boutique (quelques secondes). */
export function DemoButton({
  plan,
  children,
  ...props
}: { plan: "trial" | "pro" | "business"; children: React.ReactNode } & Pick<
  React.ComponentProps<typeof Button>,
  "variant" | "size" | "className"
>) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      {...props}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await enterDemo(plan);
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> Ouverture de la démo…
        </>
      ) : (
        children
      )}
    </Button>
  );
}

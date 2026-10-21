"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOutSafely } from "@/lib/offline/sign-out";

/** Quitte la démo puis ouvre la création de compte. */
export function DemoSignupButton({
  children,
  ...props
}: { children: React.ReactNode } & Pick<React.ComponentProps<typeof Button>, "variant" | "size" | "className">) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      {...props}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        if (!(await signOutSafely())) {
          setPending(false);
          return;
        }
        router.replace("/inscription");
        router.refresh();
      }}
    >
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

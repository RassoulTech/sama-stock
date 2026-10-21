"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOutSafely } from "@/lib/offline/sign-out";

export function SignOutButton(props: Pick<React.ComponentProps<typeof Button>, "variant" | "size" | "className">) {
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
        router.replace("/connexion");
        router.refresh();
      }}
    >
      <LogOut />
      Se déconnecter
    </Button>
  );
}

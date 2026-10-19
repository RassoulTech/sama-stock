import { Ban } from "lucide-react";
import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { getContext } from "@/server/context";
import type { BusinessContext } from "@/server/context";

export const metadata: Metadata = { title: "Compte suspendu", robots: NO_INDEX };

export default async function SuspenduPage() {
  const ctx = await getContext();
  if (!ctx) redirect("/connexion");
  if (!ctx.business || (ctx as BusinessContext).plan.status !== "suspended") redirect("/tableau-de-bord");

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <Logo className="mx-auto" />
        <div className="space-y-4 rounded-2xl border bg-card p-8">
          <Ban className="mx-auto size-12 text-destructive" />
          <h1 className="text-xl font-semibold">Ce commerce est suspendu</h1>
          <p className="text-sm text-muted-foreground">
            L&apos;accès à « {ctx.business.name} » a été suspendu. Contactez l&apos;équipe Sama Stock pour le réactiver. Vos
            données sont conservées.
          </p>
          <SignOutButton variant="outline" className="w-full" />
        </div>
      </div>
    </div>
  );
}

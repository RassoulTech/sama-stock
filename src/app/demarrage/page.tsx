import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Button } from "@/components/ui/button";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Démarrage" };

export default async function DemarragePage() {
  const ctx = await getContext();
  if (!ctx) redirect("/connexion?redirect=/demarrage");
  if (ctx.business) redirect("/tableau-de-bord");

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)]">
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-6">
        <Logo />
        <SignOutButton variant="ghost" size="sm" />
      </header>
      <main className="mx-auto max-w-xl px-4 pb-16">
        {ctx.isSuperAdmin && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-5 text-primary" /> Vous êtes super-administrateur.
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin">Administration</Link>
            </Button>
          </div>
        )}
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <OnboardingForm userName={ctx.user.name} />
        </div>
      </main>
    </div>
  );
}

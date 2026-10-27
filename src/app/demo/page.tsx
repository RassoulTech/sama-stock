import { ArrowLeft, Check, FlaskConical, MapPin, Package, Store, Users, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DemoButton } from "@/components/demo/demo-button";
import { DEMO_LICENCE, LICENSE_PACKS, limitLabel, type PlanId } from "@/lib/domain/plans";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { getSession } from "@/server/context";
import { DEMO_SPECS } from "@/server/demo/specs";

export const metadata: Metadata = pageMetadata({
  title: "Démo gratuite",
  description:
    "Essayez Sama Stock sans créer de compte : entrez dans une boutique fictive (licence Boutique, Pro ou Business) avec des ventes, du stock, des commandes et des crédits réalistes.",
  path: "/demo",
});

// La première visite du jour prépare la boutique de démonstration (quelques secondes)
export const maxDuration = 60;

const ORDER: PlanId[] = ["trial", "pro", "business"];

export default async function DemoPage() {
  const session = await getSession();
  const realAccount = session && !session.user.email.endsWith("@sama-stock.invalid") ? session.user.email : null;

  return (
    <div className="min-h-dvh bg-[#f8f9f8] dark:bg-background">
      <header className="border-b bg-white dark:bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Sama Stock, accueil">
            <Logo />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <FlaskConical className="size-3.5 text-primary" /> Démo gratuite, sans inscription
          </p>
          <h1 className="mt-5 text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
            Essayez Sama Stock dans une vraie boutique
          </h1>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
            Choisissez une licence : vous entrez dans une boutique fictive déjà remplie (ventes, stock, commandes, crédits
            clients). Vendez, encaissez, relancez, explorez les rapports : rien n&apos;est réel et tout est remis à zéro chaque
            jour.
          </p>
        </div>

        {realAccount && (
          <p className="mx-auto mt-6 max-w-2xl rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
            Vous êtes connecté avec <strong className="text-foreground">{realAccount}</strong>. Entrer dans la démo vous
            déconnectera de ce compte (vous pourrez vous reconnecter ensuite).
          </p>
        )}

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {ORDER.map((id) => {
            const plan = LICENSE_PACKS[DEMO_LICENCE[id]];
            const spec = DEMO_SPECS[id];
            const featured = id === "pro";
            const features = [
              { label: limitLabel(plan.limits.maxProducts, "produits"), ok: true },
              { label: plan.limits.maxEmployees === 0 ? "Propriétaire seul" : limitLabel(plan.limits.maxEmployees, "employés"), ok: plan.limits.maxEmployees !== 0 },
              { label: `${plan.limits.maxLocations} boutique${plan.limits.maxLocations > 1 ? "s ou dépôts" : ""}`, ok: true },
              { label: "Caisse, commandes, crédits, inventaire", ok: true },
              { label: "Rapports et ventes par catégorie", ok: plan.limits.advancedReports },
              { label: "Import et export Excel", ok: plan.limits.excel },
            ];
            return (
              <section
                key={id}
                id={id}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6 sm:p-7",
                  featured && "border-primary shadow-[0_0_0_1px_var(--primary),0_24px_48px_-24px_rgb(11_110_79/0.45)]",
                )}
              >
                {featured && (
                  <span className="absolute -top-3 left-6 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                    Recommandé
                  </span>
                )}
                <h2 className="text-[1.0625rem] font-semibold">Licence {plan.label}</h2>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="num text-3xl font-semibold tracking-[-0.04em]">{plan.price.toLocaleString("fr-FR")}</span>
                  <span className="text-sm text-muted-foreground">FCFA, une seule fois</span>
                </p>

                <div className="mt-5 rounded-xl bg-muted/50 p-4">
                  <p className="font-semibold">{spec.business.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" /> {spec.business.city} · tenue par {spec.owner.name}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{spec.pitch}</p>
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
                    <span className="inline-flex items-center gap-1">
                      <Package className="size-3.5 text-primary" /> {spec.products.length} produits
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5 text-primary" /> {spec.team.length === 0 ? "Seul" : `${spec.team.length + 1} personnes`}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Store className="size-3.5 text-primary" /> {spec.locations.length} lieu{spec.locations.length > 1 ? "x" : ""}
                    </span>
                  </p>
                </div>

                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {features.map((f) => (
                    <li key={f.label} className={cn("flex gap-2.5", !f.ok && "text-muted-foreground")}>
                      {f.ok ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />}
                      {f.label}
                    </li>
                  ))}
                </ul>

                <DemoButton plan={id} size="lg" variant={featured ? "default" : "outline"} className="mt-7 w-full">
                  Entrer dans la démo {plan.label}
                </DemoButton>
              </section>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
          Dans la démo, les paiements, les invitations d&apos;employés et les réglages du commerce sont désactivés. Prêt à
          commencer pour de vrai ?{" "}
          <Link href="/inscription" className="font-medium text-primary hover:underline">
            Créez votre compte gratuit
          </Link>{" "}
          : 14 jours offerts, sans carte bancaire.
        </p>
      </main>
    </div>
  );
}

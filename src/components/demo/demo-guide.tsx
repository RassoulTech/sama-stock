import {
  ArrowLeftRight,
  BarChart3,
  Bike,
  Check,
  FileSpreadsheet,
  HandCoins,
  Lock,
  PackageX,
  ShoppingCart,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { DEMO_LICENCE, LICENSE_PACKS, limitLabel, type PlanId } from "@/lib/domain/plans";
import { cn } from "@/lib/utils";
import { DemoButton } from "./demo-button";
import { DemoSignupButton } from "./demo-signup-button";

interface Step {
  href: string;
  icon: LucideIcon;
  title: string;
  text: string;
  /** Démos (licences) où la fonctionnalité est disponible (toutes si absent). */
  plans?: PlanId[];
}

const STEPS: Step[] = [
  { href: "/vendre", icon: ShoppingCart, title: "Faire une vente", text: "Encaissez en Wave, Orange Money ou espèces, et envoyez le reçu sur WhatsApp." },
  { href: "/commandes", icon: Bike, title: "Suivre une commande", text: "Une commande Instagram ou WhatsApp, de la préparation à la livraison." },
  { href: "/produits?etat=bas", icon: PackageX, title: "Voir les stocks bas", text: "Les produits à racheter avant la rupture." },
  { href: "/clients", icon: HandCoins, title: "Relancer un crédit", text: "Qui doit combien, et un rappel poli en un clic sur WhatsApp." },
  { href: "/produits/importer", icon: FileSpreadsheet, title: "Importer depuis Excel", text: "Votre liste de produits d'un coup, même sans modèle." },
  { href: "/rapports", icon: BarChart3, title: "Rapports et export Excel", text: "Bénéfice, ventes par catégorie, pertes… et le tout dans Excel." },
  { href: "/equipe", icon: UserCog, title: "L'équipe et ses rôles", text: "Gérant, vendeur, magasinier : chacun ne voit que ce qu'il faut.", plans: ["pro", "business"] },
  { href: "/stock/transfert", icon: ArrowLeftRight, title: "Plusieurs boutiques", text: "Transférez du stock entre la boutique et le dépôt.", plans: ["business"] },
];

const ORDER: PlanId[] = ["trial", "pro", "business"];

/** Carte d'accueil de la démo : quoi essayer, et ce que comprend la licence. */
export function DemoGuide({ plan, businessName, pitch }: { plan: PlanId; businessName: string; pitch: string }) {
  const def = LICENSE_PACKS[DEMO_LICENCE[plan]];
  const included = [
    { label: limitLabel(def.limits.maxProducts, "produits"), ok: true },
    { label: def.limits.maxEmployees === 0 ? "Propriétaire seul (pas d'employés)" : limitLabel(def.limits.maxEmployees, "employés"), ok: def.limits.maxEmployees !== 0 },
    { label: `${def.limits.maxLocations} boutique${def.limits.maxLocations > 1 ? "s ou dépôts" : ""}`, ok: true },
    { label: "Caisse, commandes, crédits, inventaire, catégories", ok: true },
    { label: "Rapports avancés et ventes par catégorie", ok: def.limits.advancedReports },
    { label: "Import et export Excel", ok: def.limits.excel },
  ];

  return (
    <Card className="mb-6 overflow-hidden border-saffron/40">
      <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold tracking-wide text-warning uppercase dark:text-saffron">Démo · licence {def.label}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">Bienvenue chez {businessName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {pitch} Touchez à tout : c&apos;est une boutique fictive, remise à zéro chaque jour.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {STEPS.map((s) => {
              const locked = s.plans && !s.plans.includes(plan);
              const Icon = s.icon;
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className={cn(
                      "flex h-full gap-3 rounded-xl border bg-card p-3 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40",
                      locked && "opacity-70",
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                      {locked ? <Lock className="size-4" /> : <Icon className="size-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {s.title}
                        {locked && <span className="ml-1.5 text-xs font-medium text-muted-foreground">({s.plans!.map((p) => LICENSE_PACKS[DEMO_LICENCE[p]].label).join(", ")})</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground">{s.text}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-sm font-semibold">
            Licence {def.label} · {def.price.toLocaleString("fr-FR")} FCFA, une seule fois
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {included.map((i) => (
              <li key={i.label} className={cn("flex gap-2", !i.ok && "text-muted-foreground")}>
                {i.ok ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />}
                {i.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-medium text-muted-foreground">Voir une autre licence</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ORDER.filter((p) => p !== plan).map((p) => (
              <DemoButton key={p} plan={p} size="sm" variant="outline" className="bg-card">
                Démo {LICENSE_PACKS[DEMO_LICENCE[p]].label}
              </DemoButton>
            ))}
          </div>
          <DemoSignupButton className="mt-4 w-full">Créer mon compte gratuit</DemoSignupButton>
        </div>
      </CardContent>
    </Card>
  );
}

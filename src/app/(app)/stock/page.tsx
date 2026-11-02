import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardList, History, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductList } from "@/components/products/product-list";
import { PageHeader } from "@/components/shared/page-header";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireContext } from "@/server/context";
import { listCategories, listProducts } from "@/server/queries/products";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  const ctx = await requireContext("products.view");
  const [products, categories] = await Promise.all([listProducts(ctx), listCategories(ctx.business.id)]);
  const writable = !ctx.plan.readOnly;
  const showCost = ctx.can("costs.view");

  const low = products.filter((p) => p.status === "low").length;
  const out = products.filter((p) => p.status === "out").length;
  const value = products.reduce((s, p) => s + Math.max(0, p.physical) * (p.costPrice ?? 0), 0);

  const actions = [
    ...(writable && ctx.can("stock.in") ? [{ href: "/stock/entree", icon: ArrowDownToLine, label: "Entrée", primary: true }] : []),
    ...(writable && ctx.can("stock.adjust") ? [{ href: "/stock/sortie", icon: ArrowUpFromLine, label: "Sortie" }] : []),
    ...(writable && ctx.can("stock.adjust") ? [{ href: "/stock/inventaire", icon: ClipboardList, label: "Inventaire" }] : []),
    ...(writable && ctx.can("stock.transfer") && ctx.locations.length > 1
      ? [{ href: "/stock/transfert", icon: ArrowLeftRight, label: "Transfert" }]
      : []),
    { href: "/stock/historique", icon: History, label: "Historique" },
  ];

  const counts = [
    { label: "Références", value: products.length, href: "/produits", tone: "" },
    { label: "Stock bas", value: low, href: "/produits?etat=bas", tone: low > 0 ? "text-saffron" : "" },
    { label: "Ruptures", value: out, href: "/produits?etat=rupture", tone: out > 0 ? "text-[#ffb4a8]" : "" },
  ];

  return (
    <>
      <PageHeader title="Stock" description={ctx.location.name} />

      <nav aria-label="Actions de stock" className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(4.25rem,1fr))] gap-3 sm:max-w-xl">
        {actions.map((a) => (
          <QuickAction key={a.href} {...a} />
        ))}
      </nav>

      {/* Valeur du stock et chiffres clés dans une seule carte, aux couleurs de la boutique */}
      <section
        aria-label="Résumé du stock"
        className="relative mb-6 overflow-hidden rounded-[1.75rem] p-5 text-primary-foreground shadow-[0_22px_44px_-24px_var(--sidebar)]"
        style={{ backgroundImage: "linear-gradient(150deg, var(--sidebar) 0%, color-mix(in oklab, var(--sidebar) 70%, black) 100%)" }}
      >
        <div aria-hidden className="absolute -top-20 -right-12 size-52 rounded-full bg-white/[0.07]" />
        {showCost && (
          <div className="relative mb-4">
            <p className="text-sm font-medium opacity-80">Valeur du stock · {ctx.location.name}</p>
            <p className="amount mt-1 text-[2rem] leading-none font-bold">{formatFCFA(value)}</p>
            <p className="mt-1 text-xs opacity-70">Au prix d&apos;achat moyen</p>
          </div>
        )}
        <div className="relative grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-white/10">
          {counts.map((c) => (
            <Link key={c.label} href={c.href} className="bg-white/[0.04] px-3 py-3 transition-colors hover:bg-white/10">
              <p className="text-xs opacity-75">{c.label}</p>
              <p className={cn("amount mt-0.5 text-xl font-bold", c.tone)}>{c.value}</p>
            </Link>
          ))}
        </div>
      </section>

      <ProductList products={products} categories={categories} showCost={showCost} />
    </>
  );
}

/** Tuile d'action : icône dans un carré arrondi, libellé dessous (comme les raccourcis de l'accueil). */
function QuickAction({ href, icon: Icon, label, primary = false }: { href: string; icon: LucideIcon; label: string; primary?: boolean }) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-2 text-center text-xs font-semibold">
      <span
        className={cn(
          "grid aspect-square w-full max-w-16 place-items-center rounded-2xl transition-transform group-active:scale-95",
          primary
            ? "bg-primary text-primary-foreground shadow-[0_10px_22px_-10px_var(--primary)]"
            : "border bg-card text-primary shadow-[0_1px_2px_rgb(11_19_16/0.05)] group-hover:border-primary/40",
        )}
      >
        <Icon className="size-6" />
      </span>
      {label}
    </Link>
  );
}

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  History,
  PackageX,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductList } from "@/components/products/product-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
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

  return (
    <>
      <PageHeader
        title="Stock"
        description={ctx.location.name}
        actions={
          <Button asChild variant="outline">
            <Link href="/stock/historique">
              <History /> Historique
            </Link>
          </Button>
        }
      />

      {writable && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ctx.can("stock.in") && (
            <QuickAction href="/stock/entree" icon={ArrowDownToLine} label="Entrée / achat" primary />
          )}
          {ctx.can("stock.adjust") && (
            <QuickAction href="/stock/sortie" icon={ArrowUpFromLine} label="Sortie / perte" />
          )}
          {ctx.can("stock.adjust") && (
            <QuickAction href="/stock/inventaire" icon={ClipboardList} label="Inventaire" />
          )}
          {ctx.can("stock.transfer") && ctx.locations.length > 1 && (
            <QuickAction href="/stock/transfert" icon={ArrowLeftRight} label="Transfert" />
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Références" value={products.length} icon={Boxes} tone="neutral" />
        <StatCard label="Stock bas" value={low} icon={AlertTriangle} tone="saffron" href="/produits?etat=bas" />
        <StatCard label="En rupture" value={out} icon={PackageX} tone="danger" href="/produits?etat=rupture" />
        {showCost && <StatCard label="Valeur du stock" value={formatFCFA(value)} icon={Wallet} hint="Au prix d'achat moyen" />}
      </div>

      <ProductList products={products} categories={categories} showCost={showCost} />
    </>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  primary = false,
}: {
  href: string;
  icon: typeof ArrowDownToLine;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border p-3.5 text-[0.8125rem] font-medium shadow-[0_1px_2px_rgb(11_19_16/0.04)] transition-colors ${
        primary
          ? "border-primary bg-primary text-primary-foreground hover:bg-[#095f44]"
          : "bg-card hover:border-primary/40"
      }`}
    >
      <span
        className={`grid size-8 place-items-center rounded-lg ${primary ? "bg-white/15" : "bg-accent text-primary"}`}
      >
        <Icon className="size-4" />
      </span>
      {label}
    </Link>
  );
}

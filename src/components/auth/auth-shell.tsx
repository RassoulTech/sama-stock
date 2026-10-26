import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { brandCss } from "@/lib/domain/brand";
import { shopColors } from "@/lib/domain/shop-brand";
import { initials } from "@/lib/format";
import type { Shop } from "@/server/queries/shop-login";

/**
 * Cadre des pages de mot de passe : aux couleurs de la boutique quand on vient de sa page de connexion,
 * sinon à celles de Sama Stock.
 */
export function AuthShell({ shop, children }: { shop: Shop | null; children: React.ReactNode }) {
  if (!shop) {
    return (
      <div className="flex min-h-dvh flex-col items-center bg-background px-4 py-10">
        <Link href="/" aria-label="Sama Stock, accueil">
          <Logo />
        </Link>
        <div className="my-auto w-full max-w-sm py-10">{children}</div>
      </div>
    );
  }
  const colors = shopColors(shop.brandColor);
  const css = brandCss(shop.brandColor);
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div aria-hidden className="absolute inset-x-0 top-0 h-56" style={{ backgroundColor: colors.sidebar }} />
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-10 pb-8">
        <div className="flex items-center justify-center gap-3 text-white">
          <span className="grid size-11 place-items-center overflow-hidden rounded-xl bg-white">
            {shop.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
              <img src={shop.logo} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-sm font-bold" style={{ color: colors.primary }}>
                {initials(shop.name)}
              </span>
            )}
          </span>
          <span className="text-lg font-semibold">{shop.name}</span>
        </div>
        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-[0_24px_48px_-24px_rgb(11_19_16/0.35)] sm:p-7">{children}</div>
        <p className="mt-auto pt-10 text-center text-[11px] tracking-wide text-muted-foreground uppercase">Propulsé par Sama Stock</p>
      </main>
    </div>
  );
}

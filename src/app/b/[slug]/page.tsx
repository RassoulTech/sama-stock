import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { brandCss } from "@/lib/domain/brand";
import { shopColors } from "@/lib/domain/shop-brand";
import { initials } from "@/lib/format";
import { NO_INDEX } from "@/lib/seo";
import { getSession } from "@/server/context";
import { shopBySlug } from "@/server/queries/shop-login";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) return { title: "Boutique introuvable", robots: NO_INDEX };
  return {
    title: { absolute: `${shop.name} · Connexion` },
    description: `Application de gestion de ${shop.name}.`,
    robots: NO_INDEX,
    applicationName: shop.name,
    // L'icône installée sur le téléphone porte le nom et le logo de la boutique, et ouvre cette page
    manifest: `/b/${shop.slug}/manifest.webmanifest`,
    icons: {
      icon: [{ url: `/b/${shop.slug}/icone/192`, type: "image/png", sizes: "192x192" }],
      apple: [{ url: `/b/${shop.slug}/icone/180`, type: "image/png", sizes: "180x180" }],
    },
    appleWebApp: { capable: true, title: shop.name, statusBarStyle: "default" },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  return { themeColor: shopColors(shop?.brandColor).sidebar };
}

/** Page de connexion d'une boutique sous licence : son nom, son logo, ses couleurs, et seulement e-mail et mot de passe. */
export default async function ShopLoginPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) notFound();

  const query = await searchParams;
  const denied = query.acces === "refuse";
  // Déjà connecté : on ouvre directement l'application de la boutique
  if (!denied && (await getSession())) redirect(`/b/${shop.slug}/entrer`);

  const email = typeof query.email === "string" && /^[^\s@]+@[^\s@]+$/.test(query.email) ? query.email.slice(0, 120) : "";
  const colors = shopColors(shop.brandColor);
  const css = brandCss(shop.brandColor);

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div aria-hidden className="absolute inset-x-0 top-0 h-72 sm:h-80" style={{ backgroundColor: colors.sidebar }}>
        <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_20%_0%,rgb(255_255_255/0.16),transparent_70%)]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-12 pb-8 sm:pt-16">
        <div className="flex flex-col items-center text-center text-white">
          <span className="grid size-20 place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)] ring-4 ring-white/20">
            {shop.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
              <img src={shop.logo} alt={`Logo de ${shop.name}`} className="size-full object-cover" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: colors.primary }}>
                {initials(shop.name)}
              </span>
            )}
          </span>
          <p className="mt-4 text-[1.375rem] leading-tight font-semibold tracking-[-0.02em]">{shop.name}</p>
          {shop.city && <p className="mt-1 text-sm text-white/75">{shop.city}</p>}
        </div>

        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-[0_24px_48px_-24px_rgb(11_19_16/0.35)] sm:p-7">
          <SignInForm
            redirectTo="/tableau-de-bord"
            googleEnabled={false}
            defaultEmail={email}
            brand={{ name: shop.name, slug: shop.slug! }}
            notice={denied ? `Ce compte n'a pas accès à ${shop.name}. Connectez-vous avec le compte de la boutique.` : null}
          />
        </div>

        <p className="mt-auto pt-10 text-center text-[11px] tracking-wide text-muted-foreground uppercase">Propulsé par Sama Stock</p>
      </main>
    </div>
  );
}

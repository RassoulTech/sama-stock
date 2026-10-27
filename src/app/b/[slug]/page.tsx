import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShopLoginPanel } from "@/components/auth/shop-login-panel";
import { ShopShell } from "@/components/auth/shop-shell";
import { InstallAppBanner } from "@/components/pwa/install-app";
import { shopColors } from "@/lib/domain/shop-brand";
import { isGoogleEnabled } from "@/lib/auth";
import { NO_INDEX } from "@/lib/seo";
import { OTHER_ACCOUNT_PARAM } from "@/lib/shop-app";
import { getSession } from "@/server/context";
import { shopBySlug, shopIcon, staffWithPin } from "@/server/queries/shop-login";
import { readDevice } from "@/server/services/devices";

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
    manifest: `/b/${shop.slug}/manifest.webmanifest?v=${shop.version}`,
    icons: {
      icon: [{ url: shopIcon(shop, 192), type: "image/png", sizes: "192x192" }],
      apple: [{ url: shopIcon(shop, 180), type: "image/png", sizes: "180x180" }],
    },
    appleWebApp: { capable: true, title: shop.name, statusBarStyle: "default" },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  return { themeColor: shopColors(shop?.brandColor).sidebar };
}

/** Page de connexion d'une boutique : clavier du code PIN sur ses appareils, e-mail et mot de passe partout. */
export default async function ShopLoginPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) notFound();

  const query = await searchParams;
  const denied = query.acces === "refuse";
  // Déjà connecté : on ouvre directement l'application de la boutique
  if (!denied && (await getSession())) redirect(`/b/${shop.slug}/entrer`);

  const email = typeof query.email === "string" && /^[^\s@]+@[^\s@]+$/.test(query.email) ? query.email.slice(0, 120) : "";
  // Appareil activé pour cette boutique : liste des employés et clavier du code PIN
  const device = await readDevice();
  const staff = device?.businessId === shop.id ? await staffWithPin(shop.id) : null;

  return (
    <ShopShell
      shop={shop}
      footer={
        <div className="mt-4 space-y-3">
          <InstallAppBanner appName={shop.name} iconUrl={shopIcon(shop, 192)} />
          <p className="text-center text-xs text-muted-foreground">
            Pas votre commerce ?{" "}
            <Link href={`/connexion?${OTHER_ACCOUNT_PARAM}=1`} prefetch={false} className="font-medium text-foreground underline-offset-2 hover:underline">
              Se connecter à un autre compte
            </Link>
          </p>
        </div>
      }
    >
      <ShopLoginPanel
        slug={shop.slug!}
        shopName={shop.name}
        staff={staff}
        defaultEmail={email}
        googleEnabled={isGoogleEnabled && !shop.licensed}
        notice={denied ? `Ce compte n'a pas accès à ${shop.name}. Connectez-vous avec le compte de la boutique.` : null}
      />
    </ShopShell>
  );
}

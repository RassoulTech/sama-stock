import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { DemoBanner } from "@/components/demo/demo-banner";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { AppProvider, type ClientAppInfo } from "@/components/shell/app-provider";
import { BottomNav } from "@/components/shell/bottom-nav";
import { LocationSwitcher } from "@/components/shell/location-switcher";
import { ClientBrand, PoweredBy } from "@/components/shell/client-brand";
import { buildNav } from "@/components/shell/nav";
import { PlanBanner } from "@/components/shell/plan-banner";
import { Sidebar } from "@/components/shell/sidebar";
import { UserMenu } from "@/components/shell/user-menu";
import { InstallAppButton } from "@/components/pwa/install-app";
import { ShopAppSync } from "@/components/pwa/shop-app-sync";
import { brandCss } from "@/lib/domain/brand";
import { shopColors } from "@/lib/domain/shop-brand";
import { initials } from "@/lib/format";
import { ROLE_LABELS, type Permission } from "@/lib/domain/permissions";
import { NO_INDEX } from "@/lib/seo";
import { isStaffEmail } from "@/lib/domain/staff-pin";
import { requireContext } from "@/server/context";
import { shopIcon } from "@/server/queries/shop-login";
import { currentShopApp } from "@/server/shop-app";
import { readDevice } from "@/server/services/devices";
import { SwitchUserButton } from "@/components/shell/switch-user-button";

const DARK_BAR = "#0b1210";

// Espace privé : jamais dans les résultats de recherche. L'application installée depuis ici est celle de la boutique :
// son nom, son icône (logo), et elle s'ouvre sur sa page de connexion.
export async function generateMetadata(): Promise<Metadata> {
  const shop = await currentShopApp();
  if (!shop) return { robots: NO_INDEX };
  return {
    robots: NO_INDEX,
    applicationName: shop.name,
    manifest: `/b/${shop.slug}/manifest.webmanifest?v=${shop.version}`,
    icons: {
      icon: [{ url: shopIcon(shop, 192), type: "image/png", sizes: "192x192" }],
      apple: [{ url: shopIcon(shop, 180), type: "image/png", sizes: "180x180" }],
    },
    appleWebApp: { capable: true, title: shop.name, statusBarStyle: "default" },
  };
}

// Barre du téléphone aux couleurs de la boutique (licences)
export async function generateViewport(): Promise<Viewport> {
  const shop = await currentShopApp();
  if (!shop?.licensed) return {};
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: shopColors(shop.brandColor).sidebar },
      { media: "(prefers-color-scheme: dark)", color: DARK_BAR },
    ],
  };
}

const ALL_PERMISSIONS: Permission[] = [
  "dashboard.full",
  "sales.create",
  "sales.cancel",
  "orders.manage",
  "products.view",
  "products.manage",
  "stock.in",
  "stock.adjust",
  "stock.transfer",
  "customers.manage",
  "suppliers.view",
  "suppliers.manage",
  "costs.view",
  "reports.view",
  "team.manage",
  "billing.manage",
  "settings.manage",
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const shopApp = await currentShopApp();
  // Appareil de la boutique (code PIN des employés) : bouton « Changer d'employé »
  const device = await readDevice();
  const sharedDevice = device?.businessId === ctx.business.id && ctx.business.slug ? `/b/${ctx.business.slug}` : null;
  const modules = { pos: ctx.business.modulePos, orders: ctx.business.moduleOrders };
  const nav = buildNav({ can: ctx.can, modules, isSuperAdmin: ctx.isSuperAdmin });

  const info: ClientAppInfo = {
    businessName: ctx.business.name,
    role: ctx.role,
    permissions: ALL_PERMISSIONS.filter((p) => ctx.can(p)),
    readOnly: ctx.plan.readOnly,
    plan: {
      id: ctx.plan.plan,
      label: ctx.plan.label,
      status: ctx.plan.status,
      daysLeft: ctx.plan.daysLeft,
      advancedReports: ctx.plan.limits.advancedReports,
    },
    modules,
    location: { id: ctx.location.id, name: ctx.location.name },
    locationCount: ctx.locations.length,
  };

  const locationList = ctx.locations.map((l) => ({ id: l.id, name: l.name }));
  // Application d'un client sous licence : sa couleur, son logo et son nom à la place de Sama Stock
  const licensed = Boolean(ctx.plan.license);
  const css = licensed ? brandCss(ctx.business.brandColor) : null;
  const menu = licensed ? nav.map((i) => (i.href === "/abonnement" ? { ...i, label: "Mon application" } : i)) : nav;

  return (
    <AppProvider value={info}>
      <OfflineProvider identity={{ userId: ctx.user.id, businessId: ctx.business.id, locationId: ctx.location.id }}>
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <ShopAppSync
          light={licensed ? shopColors(ctx.business.brandColor).sidebar : "#0b6e4f"}
          dark={DARK_BAR}
          rememberSlug={licensed && shopApp ? shopApp.slug : null}
        />
        <div className="min-h-dvh lg:grid lg:grid-cols-[244px_minmax(0,1fr)]">
          <Sidebar
            items={menu}
            brand={licensed ? <ClientBrand name={ctx.business.name} logo={ctx.business.logo} /> : undefined}
            footer={
              <>
                <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-accent text-xs font-semibold text-sidebar-foreground ring-1 ring-sidebar-border">
                    {initials(ctx.business.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.8125rem] font-medium">{ctx.business.name}</span>
                    <span className="block text-xs text-sidebar-foreground/65">
                      {ctx.plan.label} · {ROLE_LABELS[ctx.role]}
                    </span>
                  </span>
                </div>
                {licensed && <PoweredBy />}
              </>
            }
          />
          <div className="flex min-w-0 flex-col bg-white dark:bg-background">
            <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:bg-background/85 dark:supports-[backdrop-filter]:bg-background/70 print:hidden">
              <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
                <Link href="/tableau-de-bord" className="flex min-w-0 items-center gap-2.5 lg:hidden" aria-label="Accueil">
                  {licensed && ctx.business.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
                    <img src={ctx.business.logo} alt="" className="size-7 shrink-0 rounded-[9px] object-cover ring-1 ring-border" />
                  ) : (
                    <LogoMark className="size-7" />
                  )}
                  <span className={ctx.locations.length > 1 ? "sr-only" : "truncate text-[0.9375rem] font-semibold"}>
                    {ctx.business.name}
                  </span>
                </Link>
                <p className="hidden min-w-0 items-center gap-2 truncate text-[0.8125rem] text-muted-foreground lg:flex">
                  <span className="font-medium text-foreground">{ctx.business.name}</span>
                  {ctx.locations.length < 2 && (
                    <>
                      <span className="text-border">/</span> {ctx.location.name}
                    </>
                  )}
                </p>
                <div className="ml-auto flex items-center gap-2">
                  <LocationSwitcher locations={locationList} currentId={ctx.location.id} />
                  {shopApp && <InstallAppButton appName={shopApp.name} label="Installer" size="sm" className="hidden sm:inline-flex" />}
                  {sharedDevice && <SwitchUserButton href={sharedDevice} />}
                  <UserMenu
                    user={{ name: ctx.user.name, email: isStaffEmail(ctx.user.email) ? "Connexion par code PIN" : ctx.user.email }}
                    roleLabel={`${ROLE_LABELS[ctx.role]} · ${ctx.business.name}`}
                    memberships={ctx.memberships}
                    currentBusinessId={ctx.business.id}
                    isSuperAdmin={ctx.isSuperAdmin}
                    appName={shopApp?.name ?? null}
                  />
                </div>
              </div>
            </header>
            <div className="print:hidden">
              <OfflineBanner />
              {ctx.business.isDemo ? (
                <DemoBanner plan={ctx.plan.plan} />
              ) : (
                <PlanBanner plan={ctx.plan} canManageBilling={ctx.can("billing.manage")} />
              )}
            </div>
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-32 sm:px-6 lg:px-8 lg:pt-7 lg:pb-12 print:p-0">{children}</main>
          </div>
          <BottomNav items={menu} />
        </div>
      </OfflineProvider>
    </AppProvider>
  );
}

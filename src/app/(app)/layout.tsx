import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { AppProvider, type ClientAppInfo } from "@/components/shell/app-provider";
import { BottomNav } from "@/components/shell/bottom-nav";
import { LocationSwitcher } from "@/components/shell/location-switcher";
import { buildNav } from "@/components/shell/nav";
import { PlanBanner } from "@/components/shell/plan-banner";
import { Sidebar } from "@/components/shell/sidebar";
import { UserMenu } from "@/components/shell/user-menu";
import { ROLE_LABELS, type Permission } from "@/lib/domain/permissions";
import { requireContext } from "@/server/context";

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

  return (
    <AppProvider value={info}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        <Sidebar
          items={nav}
          footer={
            <div className="rounded-xl bg-muted/70 px-3 py-2.5">
              <p className="truncate text-sm font-semibold">{ctx.business.name}</p>
              <p className="text-xs text-muted-foreground">
                Formule {ctx.plan.label} · {ROLE_LABELS[ctx.role]}
              </p>
            </div>
          }
        />
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
              <Link href="/tableau-de-bord" className="flex min-w-0 items-center gap-2.5 lg:hidden">
                <LogoMark />
                <span className="truncate font-bold">{ctx.business.name}</span>
              </Link>
              <p className="hidden truncate text-sm text-muted-foreground lg:block">
                <span className="font-semibold text-foreground">{ctx.business.name}</span>
                {ctx.locations.length < 2 && <> · {ctx.location.name}</>}
              </p>
              <div className="ml-auto flex items-center gap-2">
                <LocationSwitcher locations={locationList} currentId={ctx.location.id} />
                <UserMenu
                  user={{ name: ctx.user.name, email: ctx.user.email }}
                  roleLabel={`${ROLE_LABELS[ctx.role]} · ${ctx.business.name}`}
                  memberships={ctx.memberships}
                  currentBusinessId={ctx.business.id}
                  isSuperAdmin={ctx.isSuperAdmin}
                />
              </div>
            </div>
          </header>
          <PlanBanner plan={ctx.plan} canManageBilling={ctx.can("billing.manage")} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-32 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
            {children}
          </main>
        </div>
        <BottomNav items={nav} />
      </div>
    </AppProvider>
  );
}

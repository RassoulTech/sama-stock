# Sama Stock MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Sama Stock MVP described in the validated spec — a multi-tenant stock / POS / online-orders / customer-credit SaaS for Senegalese merchants, runnable locally with one double-click.

**Architecture:** Single Next.js 16 App Router app (Cache Components disabled — classic dynamic rendering). Server Components read through `src/server/queries/*`; mutations are Server Actions in `src/server/actions/*` that all go through `runAction()` + `requireActionContext(permission)` (session → membership → role → plan state). Pure business rules live in `src/lib/domain/*` and are unit-tested with Vitest. Stock changes only happen through `applyStockMovement()` inside a DB transaction.

**Tech Stack:** Next.js 16.4, React 19.3, TypeScript, Tailwind CSS 4 + shadcn/ui (radix-nova), lucide-react, Recharts, Neon Postgres (`pg` Pool) + Drizzle ORM 0.45 / drizzle-kit 0.31, Better Auth 1.7 (email/password + Google), zod 4, next-themes, sonner, Vitest 5.

**Spec:** `docs/cahier-des-charges.md`

## Global Constraints

- UI language French; currency FCFA as integers (no decimals), formatted `12 500 FCFA`; phones normalised to `+221XXXXXXXXX`; dates in `Africa/Dakar`.
- Plans: trial 14 days (20 products, 0 employees, 1 location, no advanced reports) · pro 5 000 FCFA/30 days (50 / 3 / 1 / reports) · business 11 500 FCFA/30 days (unlimited / unlimited / 3 / reports).
- Expired trial/period → read-only (every mutation refused server-side except billing). Suspended → no access.
- Roles: owner, manager, seller, storekeeper — matrix from spec §2.3, enforced server-side. Sellers and storekeepers never receive cost prices, margins or profits in any payload.
- Stock available = physical − quantities of orders in `new`/`preparing`. Orders leave stock at `shipping`, come back at `returned`.
- Cost price = weighted average cost (rounded to integer FCFA) on purchase entries with a unit cost.
- Design: tokens from spec §7 (primary `#0B6E4F`, accent saffron `#F59E0B`, bg `#F7F8F5` / dark `#0B1210`), Plus Jakarta Sans, Lucide icons only, ≥44px touch targets, mobile bottom nav + desktop sidebar, light/dark.
- No emails in MVP: invitations are links shared via WhatsApp; payment is simulated.

---

## File Structure

```
src/
  proxy.ts                         optimistic redirect when no session cookie
  app/
    layout.tsx, globals.css, manifest.ts, icon.svg
    page.tsx                       landing page (public)
    (auth)/layout.tsx, connexion/page.tsx, inscription/page.tsx
    invitation/[token]/page.tsx    accept an invitation
    demarrage/page.tsx             onboarding (create business)
    suspendu/page.tsx
    (app)/layout.tsx               app shell (sidebar, bottom nav, header, banners)
    (app)/tableau-de-bord | vendre | ventes | commandes | produits | stock | clients
          | fournisseurs | rapports | equipe | parametres | abonnement
    admin/…                        super-admin
    api/auth/[...all]/route.ts     Better Auth handler
    api/images/produit/[id]/route.ts  product image bytes (cached)
  db/index.ts, db/schema/{auth,app,index}.ts
  lib/
    auth.ts, auth-client.ts, utils.ts
    format.ts, whatsapp.ts, image.ts (client-side resize)
    domain/{permissions,plans,stock,orders,payments}.ts (+ *.test.ts)
  server/
    context.ts                     getContext / requireContext / requireActionContext
    action.ts                      ActionError, runAction, ActionResult
    services/stock.ts              applyStockMovement, lockAndGetAvailable
    queries/*.ts                   read models per module
    actions/*.ts                   "use server" mutations per module
  components/
    ui/*                           shadcn
    shell/*                        sidebar, bottom-nav, header, switchers, banners
    shared/*                       page-header, stat-card, empty-state, money, stock-badge, product-picker…
    <module>/*                     module-specific client components
scripts/seed.ts                    demo data (idempotent)
drizzle/                           SQL migrations
lancer.bat, LISEZ-MOI.md, .env.example
```

---

### Task 1: Foundation — theme, fonts, providers, domain libs (TDD)

**Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/components/theme-provider.tsx`, `src/lib/format.ts`, `src/lib/whatsapp.ts`, `src/lib/domain/*.ts`, tests `src/lib/**/*.test.ts`, `vitest.config.ts`.

**Produces:**
- `formatFCFA(n: number): string`, `formatQty(q: number, unit?: UnitId): string`, `formatDate(d)`, `formatDateTime(d)`, `normalizePhone(input: string): string | null`, `formatPhone(p: string): string`, `UNITS`, `unitAllowsDecimals(unit)`.
- `waLink(phone: string | null, text: string): string`, `receiptMessage(...)`, `orderMessage(...)`, `debtReminderMessage(...)`, `invitationMessage(...)`.
- `Role`, `ROLE_LABELS`, `Permission`, `can(role, perm): boolean`.
- `PlanId`, `PLANS`, `computePlanState(b, now): PlanState`, `canAdd(limit: number | null, current: number): boolean`.
- `weightedAverageCost(curQty, curCost, inQty, inCost): number`, `stockStatus(available, threshold): "ok" | "low" | "out"`.
- `ORDER_STATUSES`, `canTransition(from, to)`, `orderStockEffect(from, to): "none" | "out" | "in"`, `RESERVING_STATUSES`.
- `PAYMENT_METHODS`, `CHANNELS`.

- [ ] Write failing Vitest tests for each pure function (FCFA format with narrow no-break space, phone normalisation of `77 123 45 67` / `+221771234567` / `00221…` / invalid, CMUP example 10@4000 + 10@5000 = 4500, stock status thresholds, order transition table, plan state trialing/expired/active/suspended + read-only, permission matrix rows from spec §2.3, wa.me links).
- [ ] Run `npx vitest run` → FAIL. Implement. Run → PASS. Commit.

### Task 2: Database schema + Neon migration

**Files:** `src/db/schema/auth.ts`, `src/db/schema/app.ts`, `src/db/schema/index.ts`, `src/db/index.ts`, `drizzle.config.ts`, `.env`, `.env.example`, `drizzle/*`.

Tables: Better Auth (`user`, `session`, `account`, `verification`) + `businesses`, `members`, `invitations`, `locations`, `categories`, `products`, `stock_levels` (PK product+location), `stock_movements`, `suppliers`, `purchases`, `purchase_items`, `customers`, `sales` (kind sale|order, number, channel, status, totals, amount_paid, completed_at), `sale_items` (unit_cost snapshot), `customer_payments`, `subscription_events`. Money `integer`, quantities `numeric(14,3)` mode number.

- [ ] `npx drizzle-kit generate` then `npx drizzle-kit migrate` against Neon; verify tables with a `select table_name` query. Commit.

### Task 3: Auth + context + action plumbing

**Files:** `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/proxy.ts`, `src/server/context.ts`, `src/server/action.ts`, `src/app/(auth)/*`, `src/app/demarrage/page.tsx`, `src/server/actions/business.ts`.

**Produces:** `getContext(): Promise<AppContext | null>`, `requireContext(): Promise<AppContextWithBusiness>` (redirects), `requireActionContext(perm?: Permission, opts?: { write?: boolean }): Promise<AppContextWithBusiness>`, `runAction(fn)`, `ActionError`. `AppContext` = `{ user, isSuperAdmin, memberships, business, role, locations, location, plan: PlanState, can(perm) }`.

- [ ] Sign up → onboarding creates business + owner membership + first location + trial (14 days) → redirect dashboard. Google button only rendered when `GOOGLE_CLIENT_ID` set. Verify in browser. Commit.

### Task 4: App shell
Sidebar (desktop), bottom nav (mobile), header with location switcher, trial/read-only banner, user menu (theme toggle, business switcher, sign out). Navigation filtered by role + modules. Commit.

### Task 5: Products & categories
List (search, category & stock-state filters), create/edit form with client-side image compression, archive, margin + "vente à perte" warning, image route, plan product limit. Commit.

### Task 6: Stock service & stock screens
`applyStockMovement` + row locking; overview, entry/purchase (CMUP), exit/adjustment with reasons, inventory with variance summary, transfers (business), history. Suppliers list/detail. Commit.

### Task 7: Customers & credit
List sorted by debt, create/edit, detail with history, payments, WhatsApp reminder. Commit.

### Task 8: POS + sales
POS screen (grid, search, cart, discount, payment dialog with partial payment / credit / change), `createSale` (locks stock, snapshots cost), receipt page with WhatsApp + print, sales list, cancel sale (restock). Commit.

### Task 9: Online orders
Create (customer, channel, delivery), list with status/channel filters, detail with status transitions (reserve → out → return), payment recording, WhatsApp recap. Commit.

### Task 10: Dashboard & reports
Role-aware KPIs, alerts, recent activity, onboarding checklist. Reports (Pro/Business): revenue & profit chart, top products, dormant, by channel, by payment method, losses. Commit.

### Task 11: Team, settings, subscription
Invitations by link (limit), accept flow, role change/remove; business settings, modules, locations (limit); subscription page with simulated payment + history. Commit.

### Task 12: Super-admin
Overview stats, businesses list, detail with change plan / extend / expire now / suspend. Commit.

### Task 13: Landing page + PWA
Premium landing (hero with product preview, bento features, Senegal section, pricing, FAQ, footer); manifest + icons. Commit.

### Task 14: Seed, launcher, docs
`scripts/seed.ts` (2 businesses, 6 accounts, realistic data), `lancer.bat`, `LISEZ-MOI.md`. Commit.

### Task 15: Verification
`npx vitest run`, `npx tsc --noEmit`, `npm run build`, then run the 15 acceptance scenarios from spec §9 in a real browser (Playwright), at 375px and desktop, light and dark. Fix every failure before reporting.

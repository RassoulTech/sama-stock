# Mode hors ligne — plan de construction

> **Pour l'exécution :** sous-compétence requise : superpowers:executing-plans (exécution dans cette session). Les
> étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** pendant une coupure d'internet, vendre et voir le stock. Les ventes sont gardées dans le téléphone et
envoyées automatiquement au retour du réseau, sans perte ni doublon.

**Architecture :**
- Un service worker écrit à la main (`public/sw.js`) garde une page de secours statique (`/hors-ligne`) et ses fichiers.
- Le téléphone garde dans IndexedDB une copie de la caisse (catalogue, stock, clients) et une file de ventes.
- Deux adresses dédiées (`GET /api/hors-ligne/catalogue`, `POST /api/hors-ligne/ventes`) remplissent la copie et
  reçoivent les ventes. Le serveur évite les doublons grâce à `sales.client_ref`.

**Technique :** Next.js 16.4 (App Router), React 19, Drizzle + Neon Postgres, Better Auth, zod 4, vitest, Playwright
(`playwright-core` de n8n et Chromium `ms-playwright/chromium-1243`).

**Conception :** `docs/superpowers/specs/2026-10-21-mode-hors-ligne-design.md`.

## Contraintes générales

- Ne **pas** activer `experimental.useOffline` : il garde une Server Action en attente au lieu de la faire échouer, et
  la caisse ne basculerait plus vers la file locale.
- Aucune nouvelle dépendance npm.
- Textes visibles en français simple, sans jargon. Montants avec `formatFCFA`, quantités avec `formatQty`.
- Jamais de prix d'achat ni de bénéfice dans la copie gardée par le téléphone.
- Tests vitest dans `src/**/*.test.ts` (environnement node).
- **Pas de commit ni de push sans l'accord explicite de l'utilisateur.** Les étapes « Vérifier » remplacent les
  commits : un seul commit à la fin, après accord.
- Base Neon partagée entre le local et la production : migration **additive uniquement**.
- Formatage : pas de prettier à 80 colonnes ; garder le style du fichier (lignes jusqu'à environ 140 caractères).
- Écriture des fichiers : outils Write et Edit, pas de heredoc bash.

---

### Étape 1 : Fonctions pures du mode hors ligne (types, calculs, format d'envoi)

**Fichiers :**
- Créer : `src/lib/offline/types.ts`, `src/lib/offline/sale.ts`, `src/lib/offline/stock.ts`,
  `src/lib/offline/outbox.ts`, `src/lib/offline/schema.ts`, `src/lib/domain/offline.ts`
- Tests : `src/lib/offline/offline.test.ts`

**Interfaces produites :**
- Types : `OfflineSnapshot`, `OfflineProduct`, `OutboxItem`, `SaleDraft`, `OutboxSale`, `OutboxStatus`, `SyncResult`,
  `OfflineIdentity`.
- `src/lib/offline/sale.ts` :
  - `lineTotal(quantity, unitPrice): number`
  - `saleTotals(items, discount, paymentMethod, amountReceived): { subtotal; total; amountPaid }`
  - `mergeItems(items): OutboxItem[]`
  - `buildOutboxSale(draft, identity, localNumber, now): OutboxSale`
  - `offlineLabel(n): string`
  - `canSellOffline(snapshot, now): boolean`
- `src/lib/offline/stock.ts` : `pendingQuantities(outbox, businessId, locationId)`,
  `localAvailability(products, outbox, businessId, locationId)`.
- `src/lib/offline/outbox.ts` : `applySyncResults(sent, results, now)`, `outboxSummary(outbox, userId)`,
  `sentToPurge(outbox, now)`, `SENT_KEEP_MS`.
- `src/lib/offline/schema.ts` : `OFFLINE_SYNC_VERSION`, `MAX_SYNC_BATCH`, `offlineSaleInputSchema`,
  `syncRequestSchema`, `OfflineSaleInput`, `toSyncInput(sale)`.
- `src/lib/domain/offline.ts` : `SYNC_FLAGS`, `SyncFlag`, `isSyncFlag`, `computeSyncFlags`, `clampSaleDate`,
  `FUTURE_TOLERANCE_MS`.

- [ ] **1.1 Écrire les types** — `src/lib/offline/types.ts` :

```ts
import type { SaleMethod } from "@/lib/domain/sales";

/** Produit tel que gardé dans le téléphone (jamais de prix d'achat). */
export interface OfflineProduct {
  id: string;
  name: string;
  unit: string;
  salePrice: number;
  /** Disponible au moment de la copie : stock moins les commandes réservées. */
  available: number;
  alertThreshold: number;
  categoryId: string | null;
}

/** Copie locale de la caisse, téléchargée à chaque ouverture de l'application avec internet. */
export interface OfflineSnapshot {
  version: 1;
  savedAt: string;
  user: { id: string; name: string };
  business: {
    id: string;
    name: string;
    logo: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    brandColor: string | null;
    licensed: boolean;
  };
  location: { id: string; name: string };
  can: { sell: boolean; viewStock: boolean };
  /** sellUntil : fin de l'essai ou de l'abonnement ; null pour une licence, qui n'expire jamais. */
  plan: { readOnly: boolean; sellUntil: string | null; label: string };
  modulePos: boolean;
  products: OfflineProduct[];
  categories: { id: string; name: string }[];
  customers: { id: string; name: string; phone: string | null }[];
}

export interface OutboxItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

/** Vente préparée par la caisse, avant d'être envoyée au serveur ou gardée dans le téléphone. */
export interface SaleDraft {
  clientRef: string;
  items: OutboxItem[];
  discount: number;
  paymentMethod: SaleMethod;
  amountReceived: number;
  customer: { id: string; name: string; phone: string | null } | null;
}

export type OutboxStatus = "pending" | "refused" | "sent";

/** Vente gardée dans le téléphone jusqu'à ce que le serveur l'accepte. */
export interface OutboxSale {
  clientRef: string;
  userId: string;
  businessId: string;
  locationId: string;
  /** Heure du téléphone au moment de la vente (ISO). */
  createdAt: string;
  /** Numéro provisoire du reçu : « Hors ligne n° 3 ». */
  localNumber: number;
  items: OutboxItem[];
  discount: number;
  paymentMethod: SaleMethod;
  amountReceived: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: OutboxStatus;
  error: string | null;
  attempts: number;
  serverId: string | null;
  serverNumber: string | null;
  sentAt: string | null;
}

export type SyncResult =
  | { clientRef: string; status: "ok"; id: string; number: string }
  | { clientRef: string; status: "refused"; error: string }
  | { clientRef: string; status: "retry"; error: string };

export interface OfflineIdentity {
  userId: string;
  businessId: string;
  locationId: string;
}
```

- [ ] **1.2 Écrire les tests (ils doivent échouer)** — `src/lib/offline/offline.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { clampSaleDate, computeSyncFlags, FUTURE_TOLERANCE_MS, isSyncFlag } from "@/lib/domain/offline";
import { applySyncResults, outboxSummary, SENT_KEEP_MS, sentToPurge } from "./outbox";
import { buildOutboxSale, canSellOffline, mergeItems, offlineLabel, saleTotals } from "./sale";
import { MAX_SYNC_BATCH, offlineSaleInputSchema, syncRequestSchema, toSyncInput } from "./schema";
import { localAvailability, pendingQuantities } from "./stock";
import type { OfflineSnapshot, OutboxSale, SaleDraft } from "./types";

const REF = "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b";
const REF2 = "8d1e2f3a-5b6c-4d7e-8f90-a1b2c3d4e5f6";
const ID = { userId: "u1", businessId: "b1", locationId: "l1" };
const NOW = new Date("2026-10-21T10:00:00.000Z");

function draft(over: Partial<SaleDraft> = {}): SaleDraft {
  return {
    clientRef: REF,
    items: [{ productId: "p1", name: "Ciment 50 kg", unit: "sac", quantity: 2, unitPrice: 4500 }],
    discount: 0,
    paymentMethod: "cash",
    amountReceived: 9000,
    customer: null,
    ...over,
  };
}

function sale(over: Partial<OutboxSale> = {}): OutboxSale {
  return { ...buildOutboxSale(draft(), ID, 1, NOW), ...over };
}

function snapshot(over: Partial<OfflineSnapshot> = {}): OfflineSnapshot {
  return {
    version: 1,
    savedAt: NOW.toISOString(),
    user: { id: "u1", name: "Awa" },
    business: { id: "b1", name: "Boutique Awa", logo: null, address: null, city: null, phone: null, brandColor: null, licensed: false },
    location: { id: "l1", name: "Boutique principale" },
    can: { sell: true, viewStock: true },
    plan: { readOnly: false, sellUntil: "2026-11-01T00:00:00.000Z", label: "Pro" },
    modulePos: true,
    products: [],
    categories: [],
    customers: [],
    ...over,
  };
}

describe("saleTotals", () => {
  it("arrondit chaque ligne au franc", () => {
    expect(saleTotals([{ quantity: 1.5, unitPrice: 333 }], 0, "cash", 1000)).toEqual({ subtotal: 500, total: 500, amountPaid: 500 });
  });
  it("plafonne la remise au sous-total", () => {
    expect(saleTotals([{ quantity: 1, unitPrice: 1000 }], 5000, "cash", 0).total).toBe(0);
  });
  it("n'encaisse rien pour une vente à crédit", () => {
    expect(saleTotals([{ quantity: 2, unitPrice: 1000 }], 0, "credit", 2000).amountPaid).toBe(0);
  });
  it("n'encaisse pas plus que le total (la monnaie est rendue)", () => {
    expect(saleTotals([{ quantity: 1, unitPrice: 1000 }], 0, "cash", 5000).amountPaid).toBe(1000);
  });
});

describe("mergeItems et buildOutboxSale", () => {
  it("regroupe un produit présent deux fois et retire les quantités nulles", () => {
    const items = mergeItems([
      { productId: "p1", name: "Riz", unit: "kg", quantity: 1.25, unitPrice: 500 },
      { productId: "p1", name: "Riz", unit: "kg", quantity: 0.5, unitPrice: 500 },
      { productId: "p2", name: "Sucre", unit: "kg", quantity: 0, unitPrice: 700 },
    ]);
    expect(items).toEqual([{ productId: "p1", name: "Riz", unit: "kg", quantity: 1.75, unitPrice: 500 }]);
  });
  it("prépare une vente en attente avec l'identité et l'heure du téléphone", () => {
    const s = buildOutboxSale(draft({ customer: { id: "c1", name: "Awa", phone: "771234567" } }), ID, 7, NOW);
    expect(s).toMatchObject({
      clientRef: REF,
      status: "pending",
      localNumber: 7,
      userId: "u1",
      businessId: "b1",
      locationId: "l1",
      createdAt: NOW.toISOString(),
      customerId: "c1",
      customerName: "Awa",
      customerPhone: "771234567",
      attempts: 0,
      serverNumber: null,
    });
  });
  it("affiche un numéro provisoire lisible", () => {
    expect(offlineLabel(3)).toBe("Hors ligne n° 3");
  });
});

describe("canSellOffline", () => {
  it("autorise la caisse pendant la formule", () => {
    expect(canSellOffline(snapshot(), NOW)).toBe(true);
  });
  it("bloque après la fin de l'essai ou de l'abonnement, même sans réseau", () => {
    expect(canSellOffline(snapshot({ plan: { readOnly: false, sellUntil: "2026-10-20T00:00:00.000Z", label: "Essai" } }), NOW)).toBe(false);
  });
  it("ne bloque jamais une licence (pas de date limite)", () => {
    expect(canSellOffline(snapshot({ plan: { readOnly: false, sellUntil: null, label: "Licence Pro" } }), NOW)).toBe(true);
  });
  it("bloque sans droit de vente, caisse désactivée ou lecture seule", () => {
    expect(canSellOffline(snapshot({ can: { sell: false, viewStock: true } }), NOW)).toBe(false);
    expect(canSellOffline(snapshot({ modulePos: false }), NOW)).toBe(false);
    expect(canSellOffline(snapshot({ plan: { readOnly: true, sellUntil: null, label: "Licence Pro" } }), NOW)).toBe(false);
  });
});

describe("stock local", () => {
  const outbox = [
    sale(),
    sale({ clientRef: REF2, items: [{ productId: "p1", name: "Ciment", unit: "sac", quantity: 1, unitPrice: 4500 }] }),
    sale({ clientRef: "x-refusee", status: "refused" }),
    sale({ clientRef: "x-envoyee", status: "sent" }),
    sale({ clientRef: "x-autre-lieu", locationId: "l2" }),
  ];
  it("additionne seulement les ventes en attente du même commerce et du même lieu", () => {
    expect(pendingQuantities(outbox, "b1", "l1").get("p1")).toBe(3);
  });
  it("retire les ventes en attente du disponible affiché", () => {
    const shown = localAvailability([{ id: "p1", available: 10 }, { id: "p9", available: 4 }], outbox, "b1", "l1");
    expect(shown).toEqual([{ id: "p1", available: 7 }, { id: "p9", available: 4 }]);
  });
  it("renvoie la même liste quand rien n'est en attente", () => {
    const products = [{ id: "p1", available: 10 }];
    expect(localAvailability(products, [], "b1", "l1")).toBe(products);
  });
});

describe("file d'attente", () => {
  it("applique les réponses du serveur", () => {
    const sent = [sale(), sale({ clientRef: REF2 }), sale({ clientRef: "c" }), sale({ clientRef: "d" })];
    const updated = applySyncResults(
      sent,
      [
        { clientRef: REF, status: "ok", id: "s1", number: "V-0124" },
        { clientRef: REF2, status: "refused", error: "Produit supprimé" },
        { clientRef: "c", status: "retry", error: "Erreur du serveur" },
      ],
      NOW,
    );
    expect(updated[0]).toMatchObject({ status: "sent", serverId: "s1", serverNumber: "V-0124", sentAt: NOW.toISOString(), error: null });
    expect(updated[1]).toMatchObject({ status: "refused", error: "Produit supprimé", attempts: 1 });
    expect(updated[2]).toMatchObject({ status: "pending", error: "Erreur du serveur", attempts: 1 });
    expect(updated[3]).toMatchObject({ status: "pending", attempts: 1 });
  });
  it("compte les ventes de l'utilisateur", () => {
    const outbox = [sale(), sale({ clientRef: "a", status: "refused" }), sale({ clientRef: "b", status: "sent" }), sale({ clientRef: "c", userId: "u2" })];
    expect(outboxSummary(outbox, "u1")).toEqual({ pending: 1, refused: 1, sent: 1 });
  });
  it("efface les ventes envoyées depuis plus de 24 h", () => {
    const old = new Date(NOW.getTime() - SENT_KEEP_MS - 1000).toISOString();
    const outbox = [sale({ clientRef: "vieille", status: "sent", sentAt: old }), sale({ clientRef: "recente", status: "sent", sentAt: NOW.toISOString() }), sale()];
    expect(sentToPurge(outbox, NOW)).toEqual(["vieille"]);
  });
});

describe("signalements et dates", () => {
  it("liste les points à vérifier dans un ordre fixe", () => {
    expect(computeSyncFlags({ negativeStock: true, priceChanged: true, customerMissing: false, creditWithoutCustomer: true })).toEqual([
      "stock_negatif",
      "prix_modifie",
      "credit_sans_client",
    ]);
    expect(computeSyncFlags({ negativeStock: false, priceChanged: false, customerMissing: false, creditWithoutCustomer: false })).toEqual([]);
  });
  it("reconnaît les signalements connus", () => {
    expect(isSyncFlag("stock_negatif")).toBe(true);
    expect(isSyncFlag("autre")).toBe(false);
  });
  it("ramène une heure de téléphone dans un intervalle plausible", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(clampSaleDate(new Date(NOW.getTime() + FUTURE_TOLERANCE_MS + 1000), NOW, start)).toEqual(NOW);
    expect(clampSaleDate(new Date(NOW.getTime() + 60_000), NOW, start)).toEqual(new Date(NOW.getTime() + 60_000));
    expect(clampSaleDate(new Date("2025-06-01T00:00:00Z"), NOW, start)).toEqual(start);
    expect(clampSaleDate(new Date("invalide"), NOW, start)).toEqual(NOW);
  });
});

describe("format d'envoi", () => {
  it("accepte une vente préparée par le téléphone", () => {
    expect(offlineSaleInputSchema.safeParse(toSyncInput(sale())).success).toBe(true);
  });
  it("refuse un identifiant invalide ou un panier vide", () => {
    expect(offlineSaleInputSchema.safeParse({ ...toSyncInput(sale()), clientRef: "abc" }).success).toBe(false);
    expect(offlineSaleInputSchema.safeParse({ ...toSyncInput(sale()), items: [] }).success).toBe(false);
  });
  it("limite le nombre de ventes par envoi", () => {
    const one = toSyncInput(sale());
    expect(syncRequestSchema.safeParse({ version: 1, sales: Array(MAX_SYNC_BATCH).fill(one) }).success).toBe(true);
    expect(syncRequestSchema.safeParse({ version: 1, sales: Array(MAX_SYNC_BATCH + 1).fill(one) }).success).toBe(false);
    expect(syncRequestSchema.safeParse({ version: 2, sales: [one] }).success).toBe(false);
  });
});
```

- [ ] **1.3 Lancer les tests et constater l'échec**

Lancer : `npx vitest run src/lib/offline/offline.test.ts`
Attendu : échec, les modules `./sale`, `./outbox`, `./schema`, `./stock` et `@/lib/domain/offline` sont introuvables.

- [ ] **1.4 Écrire `src/lib/offline/sale.ts`**

```ts
import type { SaleMethod } from "@/lib/domain/sales";
import { roundQty } from "@/lib/domain/stock";
import type { OfflineIdentity, OfflineSnapshot, OutboxItem, OutboxSale, SaleDraft } from "./types";

/** Total d'une ligne, arrondi au franc comme sur le serveur. */
export function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice);
}

/** Mêmes calculs que le serveur : remise plafonnée au sous-total, rien d'encaissé pour un crédit. */
export function saleTotals(
  items: Pick<OutboxItem, "quantity" | "unitPrice">[],
  discount: number,
  paymentMethod: SaleMethod,
  amountReceived: number,
): { subtotal: number; total: number; amountPaid: number } {
  const subtotal = items.reduce((s, i) => s + lineTotal(i.quantity, i.unitPrice), 0);
  const total = subtotal - Math.min(Math.max(0, discount), subtotal);
  const amountPaid = paymentMethod === "credit" ? 0 : Math.min(Math.max(0, amountReceived), total);
  return { subtotal, total, amountPaid };
}

/** Regroupe les lignes d'un même produit (comme le serveur) et retire les quantités nulles. */
export function mergeItems(items: OutboxItem[]): OutboxItem[] {
  const merged = new Map<string, OutboxItem>();
  for (const i of items) {
    const prev = merged.get(i.productId);
    merged.set(i.productId, prev ? { ...prev, quantity: roundQty(prev.quantity + i.quantity) } : { ...i, quantity: roundQty(i.quantity) });
  }
  return [...merged.values()].filter((i) => i.quantity > 0);
}

export function buildOutboxSale(draft: SaleDraft, identity: OfflineIdentity, localNumber: number, now: Date): OutboxSale {
  return {
    clientRef: draft.clientRef,
    userId: identity.userId,
    businessId: identity.businessId,
    locationId: identity.locationId,
    createdAt: now.toISOString(),
    localNumber,
    items: mergeItems(draft.items),
    discount: Math.max(0, Math.round(draft.discount)),
    paymentMethod: draft.paymentMethod,
    amountReceived: Math.max(0, Math.round(draft.amountReceived)),
    customerId: draft.customer?.id ?? null,
    customerName: draft.customer?.name ?? null,
    customerPhone: draft.customer?.phone ?? null,
    status: "pending",
    error: null,
    attempts: 0,
    serverId: null,
    serverNumber: null,
    sentAt: null,
  };
}

/** Numéro provisoire affiché sur le reçu d'une vente pas encore envoyée. */
export function offlineLabel(localNumber: number): string {
  return `Hors ligne n° ${localNumber}`;
}

/** La copie permet-elle de vendre (droit de vente, caisse activée, formule encore valable) ? */
export function canSellOffline(snapshot: OfflineSnapshot, now: Date): boolean {
  if (!snapshot.modulePos || !snapshot.can.sell || snapshot.plan.readOnly) return false;
  return snapshot.plan.sellUntil === null || now.getTime() < new Date(snapshot.plan.sellUntil).getTime();
}
```

- [ ] **1.5 Écrire `src/lib/offline/stock.ts`**

```ts
import { roundQty } from "@/lib/domain/stock";
import type { OutboxSale } from "./types";

/** Quantités des ventes encore dans le téléphone, par produit, pour un commerce et une boutique. */
export function pendingQuantities(outbox: OutboxSale[], businessId: string, locationId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const sale of outbox) {
    if (sale.status !== "pending" || sale.businessId !== businessId || sale.locationId !== locationId) continue;
    for (const i of sale.items) out.set(i.productId, roundQty((out.get(i.productId) ?? 0) + i.quantity));
  }
  return out;
}

/** Disponible affiché : celui du serveur (ou de la copie) moins les ventes pas encore envoyées. */
export function localAvailability<T extends { id: string; available: number }>(
  products: T[],
  outbox: OutboxSale[],
  businessId: string,
  locationId: string,
): T[] {
  const pending = pendingQuantities(outbox, businessId, locationId);
  if (pending.size === 0) return products;
  return products.map((p) => {
    const sold = pending.get(p.id);
    return sold ? { ...p, available: roundQty(p.available - sold) } : p;
  });
}
```

- [ ] **1.6 Écrire `src/lib/offline/outbox.ts`**

```ts
import type { OutboxSale, SyncResult } from "./types";

/** Durée pendant laquelle une vente envoyée reste visible dans « En attente ». */
export const SENT_KEEP_MS = 24 * 60 * 60 * 1000;

/** Met à jour les ventes envoyées d'après la réponse du serveur. */
export function applySyncResults(sent: OutboxSale[], results: SyncResult[], now: Date): OutboxSale[] {
  const byRef = new Map(results.map((r) => [r.clientRef, r]));
  return sent.map((sale) => {
    const r = byRef.get(sale.clientRef);
    if (!r) return { ...sale, attempts: sale.attempts + 1 };
    if (r.status === "ok") {
      return { ...sale, status: "sent", error: null, serverId: r.id, serverNumber: r.number, sentAt: now.toISOString() };
    }
    if (r.status === "refused") return { ...sale, status: "refused", error: r.error, attempts: sale.attempts + 1 };
    return { ...sale, error: r.error, attempts: sale.attempts + 1 };
  });
}

/** Compteurs affichés dans le bandeau, pour l'utilisateur connecté. */
export function outboxSummary(outbox: OutboxSale[], userId: string | null) {
  const mine = userId ? outbox.filter((s) => s.userId === userId) : outbox;
  return {
    pending: mine.filter((s) => s.status === "pending").length,
    refused: mine.filter((s) => s.status === "refused").length,
    sent: mine.filter((s) => s.status === "sent").length,
  };
}

/** Ventes envoyées depuis plus de 24 h, à effacer du téléphone. */
export function sentToPurge(outbox: OutboxSale[], now: Date): string[] {
  return outbox
    .filter((s) => s.status === "sent" && s.sentAt && now.getTime() - new Date(s.sentAt).getTime() > SENT_KEEP_MS)
    .map((s) => s.clientRef);
}
```

- [ ] **1.7 Écrire `src/lib/offline/schema.ts`**

```ts
import { z } from "zod";
import { SALE_METHODS } from "@/lib/domain/sales";
import type { OutboxSale } from "./types";

/** Format d'envoi des ventes hors ligne. Versionné : une vente gardée par une ancienne version reste envoyable. */
export const OFFLINE_SYNC_VERSION = 1;
export const MAX_SYNC_BATCH = 50;

export const offlineSaleInputSchema = z.object({
  clientRef: z.uuid(),
  businessId: z.string().min(1).max(64),
  locationId: z.string().min(1).max(64),
  createdAt: z.iso.datetime({ offset: true }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        quantity: z.number().positive().max(10_000_000),
        unitPrice: z.number().int().min(0).max(1_000_000_000),
      }),
    )
    .min(1)
    .max(200),
  discount: z.number().int().min(0).max(1_000_000_000),
  paymentMethod: z.enum(SALE_METHODS),
  amountReceived: z.number().int().min(0).max(1_000_000_000),
  customerId: z.string().min(1).max(64).nullable(),
});

export const syncRequestSchema = z.object({
  version: z.literal(OFFLINE_SYNC_VERSION),
  sales: z.array(offlineSaleInputSchema).min(1).max(MAX_SYNC_BATCH),
});

export type OfflineSaleInput = z.infer<typeof offlineSaleInputSchema>;

/** Ce qui part au serveur : l'utilisateur vient de la session, jamais du téléphone. */
export function toSyncInput(s: OutboxSale): OfflineSaleInput {
  return {
    clientRef: s.clientRef,
    businessId: s.businessId,
    locationId: s.locationId,
    createdAt: s.createdAt,
    items: s.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
    discount: s.discount,
    paymentMethod: s.paymentMethod,
    amountReceived: s.amountReceived,
    customerId: s.customerId,
  };
}
```

- [ ] **1.8 Écrire `src/lib/domain/offline.ts`**

```ts
/** Points à vérifier relevés quand une vente faite sans internet arrive sur le serveur. */
export const SYNC_FLAGS = {
  stock_negatif: {
    label: "Stock devenu négatif",
    text: "Pendant la coupure, plus d'articles ont été vendus que le stock enregistré. Vérifiez le stock et corrigez-le si besoin.",
  },
  prix_modifie: {
    label: "Prix différent",
    text: "Le prix de vente a changé entre la vente et son envoi. Le client a payé le prix affiché au moment de la vente.",
  },
  client_introuvable: {
    label: "Client introuvable",
    text: "Le client choisi a été supprimé entre-temps : la vente a été gardée sans client.",
  },
  credit_sans_client: {
    label: "Crédit sans client",
    text: "Il reste un montant à payer, mais aucun client n'est rattaché à la vente.",
  },
} as const;

export type SyncFlag = keyof typeof SYNC_FLAGS;

export function isSyncFlag(value: string): value is SyncFlag {
  return value in SYNC_FLAGS;
}

export function computeSyncFlags(f: {
  negativeStock: boolean;
  priceChanged: boolean;
  customerMissing: boolean;
  creditWithoutCustomer: boolean;
}): SyncFlag[] {
  const flags: SyncFlag[] = [];
  if (f.negativeStock) flags.push("stock_negatif");
  if (f.priceChanged) flags.push("prix_modifie");
  if (f.customerMissing) flags.push("client_introuvable");
  if (f.creditWithoutCustomer) flags.push("credit_sans_client");
  return flags;
}

/** Tolérance pour l'horloge d'un téléphone un peu en avance. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Ramène l'heure d'une vente dans un intervalle plausible (horloge du téléphone fausse). */
export function clampSaleDate(createdAt: Date, now: Date, notBefore: Date): Date {
  if (Number.isNaN(createdAt.getTime())) return now;
  if (createdAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return now;
  if (createdAt.getTime() < notBefore.getTime()) return notBefore;
  return createdAt;
}
```

- [ ] **1.9 Relancer les tests**

Lancer : `npx vitest run src/lib/offline/offline.test.ts`
Attendu : tous les tests passent.

- [ ] **1.10 Vérifier** — `npx tsc --noEmit` et `npx eslint src/lib/offline src/lib/domain/offline.ts` : aucune erreur.

---

### Étape 2 : Colonnes de la base (migration 0006, additive)

**Fichiers :**
- Modifier : `src/db/schema/app.ts` (table `sales`)
- Créer (généré) : `drizzle/0006_hors_ligne.sql` et les métadonnées `drizzle/meta/*`

**Interfaces produites :** `sales.clientRef` (`string | null`), `sales.offlineSyncedAt` (`Date | null`) et
`sales.syncFlags` (`string[]`), plus l'index unique partiel `sales_business_client_ref_uq`.

- [ ] **2.1 Ajouter l'import** en tête de `src/db/schema/app.ts` : `import { sql } from "drizzle-orm";`

- [ ] **2.2 Ajouter les colonnes** dans `sales`, juste après `updatedAt` :

```ts
    /** Identifiant créé par le téléphone : empêche d'enregistrer deux fois la même vente. */
    clientRef: text("client_ref"),
    /** Rempli quand la vente a été faite sans internet, puis envoyée plus tard. */
    offlineSyncedAt: timestamp("offline_synced_at", { withTimezone: true }),
    /** Points à vérifier relevés à l'envoi (stock négatif, prix différent…). */
    syncFlags: text("sync_flags").array().notNull().default(sql`'{}'::text[]`),
```

Et dans la liste des index de `sales` :

```ts
    uniqueIndex("sales_business_client_ref_uq").on(t.businessId, t.clientRef).where(sql`${t.clientRef} is not null`),
```

- [ ] **2.3 Générer la migration** — `npx drizzle-kit generate --name hors_ligne`
Attendu : `drizzle/0006_hors_ligne.sql` contient trois `ALTER TABLE "sales" ADD COLUMN` et un
`CREATE UNIQUE INDEX ... WHERE "sales"."client_ref" is not null`, et **aucune** instruction `DROP`. Relire le fichier
avant de continuer.

- [ ] **2.4 Appliquer** — `npx drizzle-kit migrate`. Attendu : la migration est appliquée sans erreur.

- [ ] **2.5 Vérifier** — `npx tsc --noEmit` : aucune erreur.

---

### Étape 3 : Serveur — copie de la caisse, réception des ventes, anti-doublon en ligne

**Fichiers :**
- Modifier : `src/server/context.ts` (ajouter `contextForBusiness`)
- Créer : `src/server/queries/offline.ts`, `src/server/services/offline-sales.ts`,
  `src/app/api/hors-ligne/catalogue/route.ts`, `src/app/api/hors-ligne/ventes/route.ts`
- Modifier : `src/server/actions/sales.ts` (`clientRef`)

**Interfaces :**
- Utilise (étape 1) : `OfflineSnapshot`, `SyncResult`, `OfflineSaleInput`, `syncRequestSchema`, `lineTotal`,
  `saleTotals`, `clampSaleDate`, `computeSyncFlags`.
- Produit :
  - `contextForBusiness(user: SessionUser, businessId: string, locationId: string): Promise<BusinessContext | null>`
  - `offlineSnapshot(ctx: BusinessContext): Promise<OfflineSnapshot>`
  - `findSaleByClientRef(dbOrTx: DbOrTx, businessId, clientRef): Promise<{ id: string; number: string } | null>`
  - `recordOfflineSale(user, input, now?): Promise<SyncResult>`
  - `GET /api/hors-ligne/catalogue` renvoie `OfflineSnapshot` (401 sans session, 409 sans commerce)
  - `POST /api/hors-ligne/ventes` attend `{ version: 1, sales }` et renvoie `{ results: SyncResult[] }`
    (401 sans session, 400 pour un format invalide)
  - `createSale` accepte `clientRef?: string` (UUID)

- [ ] **3.1 `contextForBusiness`** — dans `src/server/context.ts` :
  - remplacer `import { asc, eq } from "drizzle-orm";` par `import { and, asc, eq } from "drizzle-orm";` ;
  - ajouter à la fin du fichier :

```ts
/**
 * Contexte d'un commerce précis, et non celui choisi par le cookie : sert aux ventes faites hors ligne, envoyées
 * plus tard (l'utilisateur a pu changer de commerce entre-temps).
 */
export async function contextForBusiness(user: SessionUser, businessId: string, locationId: string): Promise<BusinessContext | null> {
  const [row] = await db
    .select({ member: members, business: businesses })
    .from(members)
    .innerJoin(businesses, eq(members.businessId, businesses.id))
    .where(and(eq(members.userId, user.id), eq(members.businessId, businessId)));
  if (!row || !isRole(row.member.role)) return null;

  const locs = await db.select().from(locations).where(eq(locations.businessId, businessId)).orderBy(asc(locations.createdAt));
  const location = locs.find((l) => l.id === locationId);
  if (!location) return null;

  const role = row.member.role;
  return {
    user,
    isSuperAdmin: isSuperAdminEmail(user.email),
    memberships: [],
    business: row.business,
    role,
    locations: locs,
    location,
    plan: computePlanState(row.business),
    can: (permission: Permission) => can(role, permission),
  };
}
```

- [ ] **3.2 La copie de la caisse** — `src/server/queries/offline.ts` :

```ts
import "server-only";
import type { OfflineSnapshot } from "@/lib/offline/types";
import type { BusinessContext } from "../context";
import { customerOptions } from "./customers";
import { listCategories, listProducts } from "./products";

/** Copie de la caisse gardée par le téléphone : jamais de prix d'achat ni de bénéfice. */
export async function offlineSnapshot(ctx: BusinessContext): Promise<OfflineSnapshot> {
  const [products, categories, customers] = await Promise.all([
    listProducts(ctx),
    listCategories(ctx.business.id),
    customerOptions(ctx.business.id),
  ]);
  const b = ctx.business;
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    user: { id: ctx.user.id, name: ctx.user.name },
    business: {
      id: b.id,
      name: b.name,
      logo: b.logo,
      address: b.address,
      city: b.city,
      phone: b.phone,
      brandColor: b.brandColor,
      licensed: Boolean(ctx.plan.license),
    },
    location: { id: ctx.location.id, name: ctx.location.name },
    can: { sell: ctx.can("sales.create"), viewStock: ctx.can("products.view") },
    plan: {
      readOnly: ctx.plan.readOnly,
      // Licence : la date de fin est celle de la maintenance, qui ne bloque jamais la caisse
      sellUntil: ctx.plan.license ? null : (ctx.plan.endsAt?.toISOString() ?? null),
      label: ctx.plan.label,
    },
    modulePos: b.modulePos,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      salePrice: p.salePrice,
      available: p.available,
      alertThreshold: p.alertThreshold,
      categoryId: p.categoryId,
    })),
    categories: categories.filter((c) => products.some((p) => p.categoryId === c.id)),
    customers,
  };
}
```

- [ ] **3.3 L'adresse de la copie** — `src/app/api/hors-ligne/catalogue/route.ts` :

```ts
import { NextResponse } from "next/server";
import { getContext, type BusinessContext } from "@/server/context";
import { offlineSnapshot } from "@/server/queries/offline";

const NO_STORE = { "Cache-Control": "no-store" };

/** Copie de la caisse (produits, prix, stock, clients) gardée par le téléphone pour vendre sans internet. */
export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Votre session a expiré. Reconnectez-vous." }, { status: 401, headers: NO_STORE });
  if (!ctx.business) return NextResponse.json({ error: "Aucun commerce sélectionné." }, { status: 409, headers: NO_STORE });
  return NextResponse.json(await offlineSnapshot(ctx as BusinessContext), { headers: NO_STORE });
}
```

- [ ] **3.4 L'enregistrement d'une vente hors ligne** — `src/server/services/offline-sales.ts` :

```ts
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { customers, products, saleItems, sales } from "@/db/schema";
import { clampSaleDate, computeSyncFlags } from "@/lib/domain/offline";
import { roundQty } from "@/lib/domain/stock";
import { unitAllowsDecimals } from "@/lib/format";
import type { OfflineSaleInput } from "@/lib/offline/schema";
import { lineTotal, saleTotals } from "@/lib/offline/sale";
import type { SyncResult } from "@/lib/offline/types";
import { ActionError } from "../action";
import { contextForBusiness, type SessionUser } from "../context";
import { nextNumber } from "./numbering";
import { applyStockMovement, lockStock } from "./stock";

/** Vente déjà enregistrée avec cet identifiant de téléphone (anti-doublon). */
export async function findSaleByClientRef(dbOrTx: DbOrTx, businessId: string, clientRef: string) {
  const [row] = await dbOrTx
    .select({ id: sales.id, number: sales.number })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.clientRef, clientRef)));
  return row ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * Enregistre une vente faite sans internet. Elle n'est jamais refusée pour manque de stock : l'argent est déjà
 * encaissé. Le problème est signalé au propriétaire (`sync_flags`).
 */
export async function recordOfflineSale(user: SessionUser, input: OfflineSaleInput, now = new Date()): Promise<SyncResult> {
  const clientRef = input.clientRef;
  const refused = (error: string): SyncResult => ({ clientRef, status: "refused", error });

  const ctx = await contextForBusiness(user, input.businessId, input.locationId);
  if (!ctx) return refused("Ce commerce ou cette boutique n'est plus accessible avec votre compte.");
  if (!ctx.can("sales.create")) return refused("Vous n'avez plus le droit de vendre dans ce commerce.");
  if (!ctx.business.modulePos) return refused("La caisse a été désactivée pour ce commerce.");
  if (ctx.plan.status === "suspended") return { clientRef, status: "retry", error: "Commerce suspendu : contactez Sama Stock." };

  const createdAt = clampSaleDate(new Date(input.createdAt), now, ctx.business.createdAt);
  if (ctx.plan.readOnly && !(ctx.plan.endsAt && createdAt.getTime() <= ctx.plan.endsAt.getTime())) {
    return refused("La formule était expirée au moment de la vente. Renouvelez-la pour envoyer cette vente.");
  }
  const businessId = ctx.business.id;
  const locationId = ctx.location.id;

  try {
    const sale = await db.transaction(async (tx) => {
      const existing = await findSaleByClientRef(tx, businessId, clientRef);
      if (existing) return existing;

      // Regroupe les lignes d'un même produit ; le prix est celui montré au client
      const merged = new Map<string, { quantity: number; unitPrice: number }>();
      for (const i of input.items) {
        const prev = merged.get(i.productId);
        merged.set(i.productId, { quantity: roundQty((prev?.quantity ?? 0) + i.quantity), unitPrice: i.unitPrice });
      }
      const ids = [...merged.keys()];
      const rows = await tx
        .select({ id: products.id, name: products.name, unit: products.unit, salePrice: products.salePrice, costPrice: products.costPrice })
        .from(products)
        .where(and(eq(products.businessId, businessId), inArray(products.id, ids)));
      if (rows.length !== ids.length) throw new ActionError("Un des produits vendus a été supprimé.");

      const lines = rows.map((p) => {
        const { quantity, unitPrice } = merged.get(p.id)!;
        if (!unitAllowsDecimals(p.unit) && !Number.isInteger(quantity)) {
          throw new ActionError(`« ${p.name} » se vend en unités entières.`);
        }
        return { productId: p.id, name: p.name, unit: p.unit, quantity, unitPrice, unitCost: p.costPrice, lineTotal: lineTotal(quantity, unitPrice) };
      });
      const priceChanged = rows.some((p) => merged.get(p.id)!.unitPrice !== p.salePrice);
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      if (input.discount > subtotal) throw new ActionError("La remise dépasse le montant du panier.");
      const { total, amountPaid } = saleTotals(lines, input.discount, input.paymentMethod, input.amountReceived);

      let customerId: string | null = null;
      let customerMissing = false;
      if (input.customerId) {
        const [c] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.id, input.customerId), eq(customers.businessId, businessId)));
        if (c) customerId = c.id;
        else customerMissing = true;
      }

      await lockStock(tx, businessId, locationId, ids);
      const [row] = await tx
        .insert(sales)
        .values({
          businessId,
          locationId,
          number: await nextNumber(tx, businessId, "sale"),
          kind: "sale",
          channel: "boutique",
          status: "completed",
          customerId,
          userId: user.id,
          subtotal,
          discount: input.discount,
          total,
          amountPaid,
          paymentMethod: input.paymentMethod,
          createdAt,
          completedAt: createdAt,
          clientRef,
          offlineSyncedAt: now,
        })
        .returning({ id: sales.id, number: sales.number });
      await tx.insert(saleItems).values(lines.map((l) => ({ saleId: row!.id, ...l })));

      let negativeStock = false;
      for (const l of lines) {
        const left = await applyStockMovement(tx, {
          businessId,
          locationId,
          productId: l.productId,
          quantity: -l.quantity,
          type: "sale",
          refType: "sale",
          refId: row!.id,
          unitCost: l.unitCost,
          userId: user.id,
        });
        if (left < 0) negativeStock = true;
      }
      const flags = computeSyncFlags({ negativeStock, priceChanged, customerMissing, creditWithoutCustomer: amountPaid < total && !customerId });
      if (flags.length > 0) await tx.update(sales).set({ syncFlags: flags }).where(eq(sales.id, row!.id));
      return row!;
    });
    return { clientRef, status: "ok", id: sale.id, number: sale.number };
  } catch (error) {
    if (error instanceof ActionError) return refused(error.message);
    if (isUniqueViolation(error)) {
      const existing = await findSaleByClientRef(db, businessId, clientRef);
      if (existing) return { clientRef, status: "ok", id: existing.id, number: existing.number };
    }
    console.error("[hors-ligne]", error);
    return { clientRef, status: "retry", error: "Erreur du serveur : nouvel essai dans un instant." };
  }
}
```

- [ ] **3.5 L'adresse d'envoi** — `src/app/api/hors-ligne/ventes/route.ts` :

```ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { syncRequestSchema } from "@/lib/offline/schema";
import type { SyncResult } from "@/lib/offline/types";
import { getSession } from "@/server/context";
import { recordOfflineSale } from "@/server/services/offline-sales";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Reçoit les ventes faites sans internet. Une adresse fixe et non une Server Action : l'identifiant d'une Server
 * Action change à chaque mise en ligne, alors qu'une vente gardée par une ancienne version doit rester envoyable.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Votre session a expiré. Reconnectez-vous." }, { status: 401, headers: NO_STORE });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400, headers: NO_STORE });
  }
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Format de vente invalide." }, { status: 400, headers: NO_STORE });

  const user = { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null };
  const results: SyncResult[] = [];
  // Une par une : chaque vente a sa transaction et son numéro, une vente refusée ne bloque pas les autres
  for (const sale of parsed.data.sales) results.push(await recordOfflineSale(user, sale));
  if (results.some((r) => r.status === "ok")) revalidatePath("/", "layout");
  return NextResponse.json({ results }, { headers: NO_STORE });
}
```

- [ ] **3.6 Anti-doublon de la vente en ligne** — dans `src/server/actions/sales.ts` :
  - ajouter l'import `import { findSaleByClientRef } from "../services/offline-sales";` ;
  - dans `saleSchema`, ajouter `clientRef: z.uuid().optional(),` ;
  - au début du callback `db.transaction(async (tx) => {`, avant `priceAndReserve`, ajouter :

```ts
      // Même vente renvoyée (réponse perdue pendant une coupure) : on renvoie celle qui existe déjà
      if (data.clientRef) {
        const existing = await findSaleByClientRef(tx, ctx.business.id, data.clientRef);
        if (existing) return existing.id;
      }
```

  - dans `.values({ ... })` de l'insertion, ajouter `clientRef: data.clientRef ?? null,`.

- [ ] **3.7 Vérifier** — `npx tsc --noEmit`, `npx eslint src/server src/app/api/hors-ligne` et `npx vitest run` : aucune
  erreur. Le parcours complet est vérifié à l'étape 9.

---

### Étape 4 : Téléphone — stockage local, service worker, fournisseur et bandeau

**Fichiers :**
- Créer :
  - `src/lib/offline/db.ts`
  - `public/sw.js`
  - `src/components/offline/offline-provider.tsx`
  - `src/components/offline/offline-banner.tsx`
- Modifier : `next.config.ts`, `src/app/(app)/layout.tsx`

**Interfaces :**
- Utilise : `buildOutboxSale`, `applySyncResults`, `outboxSummary`, `sentToPurge`, `toSyncInput`,
  `offlineSaleInputSchema`, `OFFLINE_SYNC_VERSION` et `MAX_SYNC_BATCH`.
- Produit :
  - `offlineDb` : `getSnapshot`, `saveSnapshot`, `clearSnapshot`, `listOutbox`, `putOutbox`, `deleteOutbox`,
    `nextLocalNumber`
  - `<OfflineProvider identity?>`
  - `useOfflineMode(): OfflineState`, avec `ready`, `online`, `identity`, `snapshot`, `outbox`, `summary`,
    `sessionExpired`, `justSent`, `enqueueSale(draft)`, `syncNow()`, `refreshSnapshot(force?)`, `retrySale(ref)` et
    `removeSale(ref)`
  - `<OfflineBanner inOfflineApp? onShowPending? />`

- [ ] **4.1 Stockage local** — `src/lib/offline/db.ts` :

```ts
import type { OfflineSnapshot, OutboxSale } from "./types";

const DB_NAME = "sama-stock";
const DB_VERSION = 1;
type StoreName = "snapshot" | "outbox" | "meta";

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshot")) db.createObjectStore("snapshot");
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "clientRef" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

/** Une transaction sur un magasin : résout avec le résultat de la requête quand tout est bien écrit. */
function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

/** Données gardées par le téléphone pour la caisse hors ligne. */
export const offlineDb = {
  getSnapshot: async () => (await run<OfflineSnapshot>("snapshot", "readonly", (s) => s.get("current"))) ?? null,
  saveSnapshot: async (snapshot: OfflineSnapshot) => {
    await run("snapshot", "readwrite", (s) => s.put(snapshot, "current"));
  },
  clearSnapshot: async () => {
    await run("snapshot", "readwrite", (s) => s.delete("current"));
  },
  listOutbox: async () => (await run<OutboxSale[]>("outbox", "readonly", (s) => s.getAll())) ?? [],
  putOutbox: async (sale: OutboxSale) => {
    await run("outbox", "readwrite", (s) => s.put(sale));
  },
  deleteOutbox: async (clientRef: string) => {
    await run("outbox", "readwrite", (s) => s.delete(clientRef));
  },
  /** Numéro provisoire suivant (« Hors ligne n° 3 »), propre au téléphone. */
  nextLocalNumber: async () => {
    const db = await openDb();
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction("meta", "readwrite");
      const store = tx.objectStore("meta");
      let next = 1;
      const req = store.get("localCounter");
      req.onsuccess = () => {
        next = (Number(req.result) || 0) + 1;
        store.put(next, "localCounter");
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(tx.error);
    });
  },
};
```

- [ ] **4.2 Service worker** — `public/sw.js` :

```js
/* Service worker de Sama Stock : garde la caisse hors ligne (/hors-ligne) et ses fichiers. */
const PRECACHE_PREFIX = "sama-offline-";
const OFFLINE_URL = "/hors-ligne";
const EXTRA = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

let precaching = null;
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "precache" && typeof data.version === "string") {
    precaching = precaching || precache(data.version).finally(() => (precaching = null));
    event.waitUntil(precaching);
  }
});

async function precache(version) {
  const name = PRECACHE_PREFIX + version;
  const existing = await caches.open(name);
  if (await existing.match(OFFLINE_URL)) return;

  const res = await fetch(OFFLINE_URL, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) return;
  const html = await res.clone().text();
  const assets = new Set(EXTRA);
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(m[0]);

  const cache = await caches.open(name);
  const styles = [];
  await Promise.all(
    [...assets].map(async (url) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return;
        if (url.includes(".css")) styles.push(await r.clone().text());
        await cache.put(url, r);
      } catch {}
    }),
  );
  // Polices et images citées par les feuilles de style
  const more = new Set();
  for (const css of styles) for (const m of css.matchAll(/\/_next\/static\/media\/[^"'\s)]+/g)) if (!assets.has(m[0])) more.add(m[0]);
  await Promise.all(
    [...more].map(async (url) => {
      try {
        const r = await fetch(url);
        if (r.ok) await cache.put(url, r);
      } catch {}
    }),
  );
  // La page en dernier : sa présence signifie que tout est prêt
  await cache.put(OFFLINE_URL, res);
  for (const key of await caches.keys()) if (key.startsWith(PRECACHE_PREFIX) && key !== name) await caches.delete(key);
}

async function offlinePage() {
  for (const key of await caches.keys()) {
    if (!key.startsWith(PRECACHE_PREFIX)) continue;
    const hit = await (await caches.open(key)).match(OFFLINE_URL);
    if (hit) return hit;
  }
  return null;
}

function notReady() {
  const html =
    '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Pas d'internet · Sama Stock</title>" +
    '<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;color:#0b1310;line-height:1.5">' +
    "<h1 style=\"font-size:1.25rem\">Pas d'internet</h1>" +
    "<p>Ouvrez Sama Stock une fois avec internet : le téléphone gardera alors une copie de la caisse pour vendre pendant les coupures.</p>" +
    "</body></html>";
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function navigate(request, url) {
  try {
    return await fetch(request);
  } catch {
    const page = await offlinePage();
    if (!page) return notReady();
    if (url.pathname === OFFLINE_URL) return page;
    const target = new URL(OFFLINE_URL, self.location.origin);
    target.searchParams.set("depuis", url.pathname);
    return Response.redirect(target.href, 302);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || EXTRA.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});
```

- [ ] **4.3 `next.config.ts`** — ajouter dans `nextConfig`, avant `turbopack` :

```ts
  // Version de l'application : le service worker remet en cache la caisse hors ligne quand elle change
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}` },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
```

- [ ] **4.4 Fournisseur** — `src/components/offline/offline-provider.tsx` :

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { offlineDb } from "@/lib/offline/db";
import { applySyncResults, outboxSummary, sentToPurge } from "@/lib/offline/outbox";
import { buildOutboxSale } from "@/lib/offline/sale";
import { MAX_SYNC_BATCH, OFFLINE_SYNC_VERSION, offlineSaleInputSchema, toSyncInput } from "@/lib/offline/schema";
import type { OfflineIdentity, OfflineSnapshot, OutboxSale, SaleDraft, SyncResult } from "@/lib/offline/types";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
/** Copie rafraîchie au plus toutes les 2 minutes (sauf après une vente). */
const SNAPSHOT_MAX_AGE_MS = 2 * 60 * 1000;
const RETRY_EVERY_MS = 30 * 1000;
const JUST_SENT_MS = 5000;

export interface OfflineState {
  ready: boolean;
  online: boolean;
  identity: OfflineIdentity | null;
  snapshot: OfflineSnapshot | null;
  outbox: OutboxSale[];
  summary: { pending: number; refused: number; sent: number };
  sessionExpired: boolean;
  justSent: number;
  enqueueSale: (draft: SaleDraft) => Promise<OutboxSale>;
  syncNow: () => Promise<void>;
  refreshSnapshot: (force?: boolean) => Promise<void>;
  retrySale: (clientRef: string) => Promise<void>;
  removeSale: (clientRef: string) => Promise<void>;
}

const OfflineContext = createContext<OfflineState | null>(null);

export function useOfflineMode(): OfflineState {
  const value = useContext(OfflineContext);
  if (!value) throw new Error("useOfflineMode doit être utilisé dans OfflineProvider");
  return value;
}

/** Enregistre le service worker et lui demande de garder la caisse hors ligne de cette version. */
function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => reg.active?.postMessage({ type: "precache", version: BUILD_ID }))
    .catch(() => {});
}

/**
 * Mode hors ligne : garde une copie de la caisse dans le téléphone, met les ventes en file pendant une coupure et
 * les envoie au retour d'internet.
 */
export function OfflineProvider({ identity: given, children }: { identity?: OfflineIdentity; children: React.ReactNode }) {
  const router = useRouter();
  const gUser = given?.userId;
  const gBusiness = given?.businessId;
  const gLocation = given?.locationId;

  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [outbox, setOutbox] = useState<OutboxSale[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [justSent, setJustSent] = useState(0);
  const syncing = useRef(false);
  const fetching = useRef(false);

  const identity = useMemo<OfflineIdentity | null>(() => {
    if (gUser && gBusiness && gLocation) return { userId: gUser, businessId: gBusiness, locationId: gLocation };
    return snapshot ? { userId: snapshot.user.id, businessId: snapshot.business.id, locationId: snapshot.location.id } : null;
  }, [gUser, gBusiness, gLocation, snapshot]);

  const reloadOutbox = useCallback(async () => {
    const all = await offlineDb.listOutbox();
    const purge = sentToPurge(all, new Date());
    for (const ref of purge) await offlineDb.deleteOutbox(ref);
    setOutbox(all.filter((s) => !purge.includes(s.clientRef)));
  }, []);

  const refreshSnapshot = useCallback(
    async (force = false) => {
      if (fetching.current) return;
      const current = await offlineDb.getSnapshot().catch(() => null);
      const same =
        current && (!gUser || (current.user.id === gUser && current.business.id === gBusiness && current.location.id === gLocation));
      if (!force && same && Date.now() - new Date(current.savedAt).getTime() < SNAPSHOT_MAX_AGE_MS) return;
      fetching.current = true;
      try {
        const res = await fetch("/api/hors-ligne/catalogue", { cache: "no-store" });
        setOnline(true);
        if (res.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (!res.ok) return;
        const next = (await res.json()) as OfflineSnapshot;
        await offlineDb.saveSnapshot(next);
        setSnapshot(next);
        setSessionExpired(false);
      } catch {
        setOnline(false);
      } finally {
        fetching.current = false;
      }
    },
    [gUser, gBusiness, gLocation],
  );

  const syncNow = useCallback(async () => {
    const userId = gUser ?? (await offlineDb.getSnapshot().catch(() => null))?.user.id;
    if (!userId || syncing.current) return;
    syncing.current = true;
    let sent = 0;
    const send = async () => {
      const pending = (await offlineDb.listOutbox()).filter((s) => s.userId === userId && s.status === "pending");
      for (let i = 0; i < pending.length; i += MAX_SYNC_BATCH) {
        const valid: OutboxSale[] = [];
        for (const s of pending.slice(i, i + MAX_SYNC_BATCH)) {
          if (offlineSaleInputSchema.safeParse(toSyncInput(s)).success) valid.push(s);
          else await offlineDb.putOutbox({ ...s, status: "refused", error: "Vente illisible : contactez Sama Stock." });
        }
        if (valid.length === 0) continue;
        let res: Response;
        try {
          res = await fetch("/api/hors-ligne/ventes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: OFFLINE_SYNC_VERSION, sales: valid.map(toSyncInput) }),
            cache: "no-store",
          });
        } catch {
          setOnline(false);
          return;
        }
        setOnline(true);
        if (res.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (!res.ok) return;
        const { results } = (await res.json()) as { results: SyncResult[] };
        for (const s of applySyncResults(valid, results, new Date())) {
          await offlineDb.putOutbox(s);
          if (s.status === "sent") sent += 1;
        }
      }
    };
    try {
      // Un seul envoi à la fois, même avec plusieurs onglets ouverts
      if (navigator.locks) await navigator.locks.request("sama-stock-sync", send);
      else await send();
    } catch {
      // Base locale indisponible : nouvel essai au prochain déclencheur
    } finally {
      syncing.current = false;
      await reloadOutbox().catch(() => {});
      if (sent > 0) {
        setJustSent(sent);
        router.refresh();
        void refreshSnapshot(true);
      }
    }
  }, [gUser, reloadOutbox, refreshSnapshot, router]);

  const enqueueSale = useCallback(
    async (draft: SaleDraft) => {
      if (!identity) throw new Error("La caisse hors ligne n'est pas prête.");
      const sale = buildOutboxSale(draft, identity, await offlineDb.nextLocalNumber(), new Date());
      await offlineDb.putOutbox(sale);
      await reloadOutbox();
      void syncNow();
      return sale;
    },
    [identity, reloadOutbox, syncNow],
  );

  const retrySale = useCallback(
    async (clientRef: string) => {
      const sale = (await offlineDb.listOutbox()).find((s) => s.clientRef === clientRef);
      if (!sale) return;
      await offlineDb.putOutbox({ ...sale, status: "pending", error: null });
      await reloadOutbox();
      void syncNow();
    },
    [reloadOutbox, syncNow],
  );

  const removeSale = useCallback(
    async (clientRef: string) => {
      await offlineDb.deleteOutbox(clientRef);
      await reloadOutbox();
    },
    [reloadOutbox],
  );

  // Démarrage : service worker, données du téléphone, copie à jour et envoi des ventes en attente
  useEffect(() => {
    let cancelled = false;
    registerServiceWorker();
    navigator.storage?.persist?.().catch(() => {});
    void (async () => {
      const snap = await offlineDb.getSnapshot().catch(() => null);
      await reloadOutbox().catch(() => {});
      if (cancelled) return;
      setSnapshot(snap);
      setOnline(navigator.onLine);
      setReady(true);
      if (navigator.onLine) {
        await refreshSnapshot();
        void syncNow();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSnapshot, reloadOutbox, syncNow]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void refreshSnapshot();
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshSnapshot, syncNow]);

  const summary = useMemo(() => outboxSummary(outbox, identity?.userId ?? null), [outbox, identity]);

  // Nouvel essai régulier tant qu'il reste des ventes à envoyer (sert aussi à détecter le retour du réseau)
  useEffect(() => {
    if (summary.pending === 0) return;
    const timer = setInterval(() => void syncNow(), RETRY_EVERY_MS);
    return () => clearInterval(timer);
  }, [summary.pending, syncNow]);

  useEffect(() => {
    if (justSent === 0) return;
    const timer = setTimeout(() => setJustSent(0), JUST_SENT_MS);
    return () => clearTimeout(timer);
  }, [justSent]);

  const value = useMemo<OfflineState>(
    () => ({
      ready,
      online,
      identity,
      snapshot,
      outbox,
      summary,
      sessionExpired,
      justSent,
      enqueueSale,
      syncNow,
      refreshSnapshot,
      retrySale,
      removeSale,
    }),
    [ready, online, identity, snapshot, outbox, summary, sessionExpired, justSent, enqueueSale, syncNow, refreshSnapshot, retrySale, removeSale],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
```

- [ ] **4.5 Bandeau** — `src/components/offline/offline-banner.tsx` :

```tsx
"use client";

import { CheckCircle2, CloudOff, Loader2, LogIn, TriangleAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOfflineMode } from "./offline-provider";

function ventes(n: number) {
  return `${n} vente${n > 1 ? "s" : ""}`;
}

/** Un seul message à la fois : session expirée, pas d'internet, ventes refusées, envoi en cours, envoi réussi. */
export function OfflineBanner({ inOfflineApp = false, onShowPending }: { inOfflineApp?: boolean; onShowPending?: () => void }) {
  const o = useOfflineMode();
  const pathname = usePathname();
  const { pending, refused } = o.summary;
  const link = "font-semibold underline underline-offset-4";

  let tone: "saffron" | "red" | "blue" | "green";
  let icon: React.ReactNode;
  let content: React.ReactNode;

  if (o.sessionExpired && pending + refused > 0) {
    tone = "saffron";
    icon = <LogIn className="size-4" />;
    content = (
      <>
        Reconnectez-vous pour envoyer {ventes(pending + refused)}.{" "}
        <a href="/connexion?redirect=/vendre" className={link}>
          Se connecter
        </a>
      </>
    );
  } else if (!o.online) {
    tone = "saffron";
    icon = <CloudOff className="size-4" />;
    content = (
      <>
        Pas d&apos;internet : vous pouvez continuer à vendre.
        {pending > 0 && <> {ventes(pending)} en attente d&apos;envoi.</>}
        {!inOfflineApp && pathname !== "/vendre" && (
          <>
            {" "}
            <a href="/hors-ligne" className={link}>
              Ouvrir la caisse
            </a>
          </>
        )}
      </>
    );
  } else if (refused > 0) {
    tone = "red";
    icon = <TriangleAlert className="size-4" />;
    content = (
      <>
        {ventes(refused)} n&apos;{refused > 1 ? "ont" : "a"} pas pu être envoyée{refused > 1 ? "s" : ""}.{" "}
        {inOfflineApp ? (
          <button type="button" onClick={onShowPending} className={link}>
            Voir
          </button>
        ) : (
          <a href="/hors-ligne?onglet=attente" className={link}>
            Voir
          </a>
        )}
      </>
    );
  } else if (pending > 0) {
    tone = "blue";
    icon = <Loader2 className="size-4 animate-spin" />;
    content = <>Envoi de {ventes(pending)} faite{pending > 1 ? "s" : ""} sans internet…</>;
  } else if (o.justSent > 0) {
    tone = "green";
    icon = <CheckCircle2 className="size-4" />;
    content = <>{ventes(o.justSent)} envoyée{o.justSent > 1 ? "s" : ""}.</>;
  } else {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-center text-[0.8125rem]",
        tone === "saffron" && "bg-saffron/15 text-warning dark:text-saffron",
        tone === "red" && "bg-destructive/10 text-destructive",
        tone === "blue" && "bg-accent text-accent-foreground",
        tone === "green" && "bg-success/10 text-success",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span>{content}</span>
    </div>
  );
}
```

- [ ] **4.6 Brancher dans `src/app/(app)/layout.tsx`** :
  - ajouter les imports `import { OfflineBanner } from "@/components/offline/offline-banner";` et
    `import { OfflineProvider } from "@/components/offline/offline-provider";` ;
  - envelopper le contenu de `<AppProvider value={info}>` dans
    `<OfflineProvider identity={{ userId: ctx.user.id, businessId: ctx.business.id, locationId: ctx.location.id }}>` … `</OfflineProvider>` ;
  - dans `<div className="print:hidden">`, placer `<OfflineBanner />` avant les bandeaux démo ou formule.

- [ ] **4.7 Vérifier** — `npx tsc --noEmit`, `npx eslint src/components/offline src/lib/offline "src/app/(app)/layout.tsx" next.config.ts` :
  aucune erreur.

---

### Étape 5 : Une seule caisse pour les deux modes, reçu provisoire

**Fichiers :**
- Modifier :
  - `src/components/pos/pos-screen.tsx`
  - `src/components/pos/checkout-dialog.tsx`
  - `src/components/customers/customer-combobox.tsx`
  - `src/components/sales/receipt.tsx`
  - `src/app/(app)/vendre/page.tsx`
- Créer : `src/components/offline/offline-receipt.tsx`, `src/components/offline/online-pos.tsx`

**Interfaces :**
- Produit :
  - `PosScreen` reçoit `submit: (draft: SaleDraft) => Promise<string | null>`, `allowCustomerCreate?: boolean` et
    `bottomNav?: boolean` ;
  - `Receipt` reçoit `{ sale: ReceiptData; business: ReceiptBusiness }` ;
  - `<OfflineReceipt sale business sellerName onNewSale />` et `outboxReceipt(sale, sellerName): ReceiptData` ;
  - `<OnlinePos products categories customers business sellerName />`.

- [ ] **5.1 `CustomerCombobox`** — ajouter la propriété `allowCreate = true` (type `allowCreate?: boolean`) et entourer
  l'élément « Nouveau client » (`<CommandItem value="__new__ nouveau client" …>…</CommandItem>`) de
  `{allowCreate && ( … )}`.

- [ ] **5.2 `CheckoutDialog`** :
  - dans `CheckoutProps`, ajouter `allowCustomerCreate?: boolean;` ;
  - dans `CheckoutForm`, la récupérer (`allowCustomerCreate = true` dans la déstructuration) et passer
    `allowCreate={allowCustomerCreate}` à `CustomerCombobox` ;
  - juste après `CustomerCombobox`, à l'intérieur du `FormField`, ajouter :

```tsx
          {!allowCustomerCreate && (
            <p className="text-xs text-muted-foreground">Sans internet, choisissez un client déjà enregistré.</p>
          )}
```

- [ ] **5.3 `PosScreen`** :
  - retirer `import { useRouter } from "next/navigation";` et `import { createSale } from "@/server/actions/sales";` ;
  - ajouter `import type { SaleDraft } from "@/lib/offline/types";` ;
  - dans les propriétés, ajouter :

```tsx
  submit,
  allowCustomerCreate = true,
  bottomNav = true,
}: {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  customers: CustomerOption[];
  /** Enregistre la vente : renvoie un message d'erreur, ou null quand c'est fait. */
  submit: (draft: SaleDraft) => Promise<string | null>;
  allowCustomerCreate?: boolean;
  /** Une barre de navigation est-elle affichée en bas de l'écran (téléphone) ? */
  bottomNav?: boolean;
}) {
```

  - retirer `const router = useRouter();` ;
  - remplacer la fonction `checkout` par :

```tsx
  function checkout(result: CheckoutResult) {
    setError(null);
    const customer = result.customerId ? (customers.find((c) => c.id === result.customerId) ?? null) : null;
    const draft: SaleDraft = {
      clientRef: crypto.randomUUID(),
      items: lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        unit: l.product.unit,
        quantity: l.qty,
        unitPrice: l.product.salePrice,
      })),
      discount: discountValue,
      paymentMethod: result.paymentMethod,
      amountReceived: result.amountReceived,
      customer: customer && { id: customer.id, name: customer.name, phone: customer.phone },
    };
    startTransition(async () => {
      const failure = await submit(draft);
      if (failure) {
        setError(failure);
        return;
      }
      setCheckoutOpen(false);
      setCartOpen(false);
      setCart(new Map());
      setDiscount("");
      setShowDiscount(false);
    });
  }
```

  - passer `allowCustomerCreate={allowCustomerCreate}` à `CheckoutDialog` ;
  - barre panier mobile : remplacer
    `className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3 lg:hidden"` par
    `className={cn("fixed inset-x-0 z-30 px-4 pb-3 lg:hidden", bottomNav ? "bottom-[calc(4rem+env(safe-area-inset-bottom))]" : "bottom-[env(safe-area-inset-bottom)]")}`.

- [ ] **5.4 `Receipt` avec un type réduit** — dans `src/components/sales/receipt.tsx`, remplacer les imports de `Business`
  et `SaleDetail` et la signature par :

```tsx
/** Ce qu'il faut pour afficher un reçu : une vente du serveur ou une vente encore dans le téléphone. */
export interface ReceiptData {
  number: string;
  createdAt: Date;
  status: string;
  sellerName: string | null;
  customer: { name: string } | null;
  items: { id: string; name: string; unit: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  amountPaid: number;
  paymentMethod: string | null;
}

export interface ReceiptBusiness {
  name: string;
  logo: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
}

export function Receipt({ sale, business }: { sale: ReceiptData; business: ReceiptBusiness }) {
```

Le reste du composant ne change pas. `SaleDetail` et `Business`, déjà passés par `ventes/[id]` et les commandes,
restent compatibles.

- [ ] **5.5 Reçu provisoire** — `src/components/offline/offline-receipt.tsx` :

```tsx
"use client";

import { CheckCircle2, CloudOff, MessageCircle, Plus } from "lucide-react";
import { PrintButton } from "@/components/sales/print-button";
import { Receipt, type ReceiptBusiness, type ReceiptData } from "@/components/sales/receipt";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHODS } from "@/lib/domain/sales";
import { lineTotal, offlineLabel, saleTotals } from "@/lib/offline/sale";
import type { OutboxSale } from "@/lib/offline/types";
import { cn } from "@/lib/utils";
import { receiptMessage, waLink } from "@/lib/whatsapp";
import { useOfflineMode } from "./offline-provider";

/** Reçu d'une vente gardée dans le téléphone (numéro provisoire tant qu'elle n'est pas envoyée). */
export function outboxReceipt(sale: OutboxSale, sellerName: string | null): ReceiptData {
  const { subtotal, total, amountPaid } = saleTotals(sale.items, sale.discount, sale.paymentMethod, sale.amountReceived);
  return {
    number: sale.serverNumber ?? offlineLabel(sale.localNumber),
    createdAt: new Date(sale.createdAt),
    status: "completed",
    sellerName,
    customer: sale.customerName ? { name: sale.customerName } : null,
    items: sale.items.map((i) => ({ id: i.productId, name: i.name, unit: i.unit, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: lineTotal(i.quantity, i.unitPrice) })),
    subtotal,
    discount: sale.discount,
    deliveryFee: 0,
    total,
    amountPaid,
    paymentMethod: sale.paymentMethod,
  };
}

export function OfflineReceipt({
  sale: initial,
  business,
  sellerName,
  onNewSale,
}: {
  sale: OutboxSale;
  business: ReceiptBusiness;
  sellerName: string | null;
  onNewSale: () => void;
}) {
  const { outbox } = useOfflineMode();
  // Version à jour : le vrai numéro apparaît dès que la vente est envoyée
  const sale = outbox.find((s) => s.clientRef === initial.clientRef) ?? initial;
  const data = outboxReceipt(sale, sellerName);
  const sent = sale.status === "sent";
  const message = receiptMessage({
    businessName: business.name,
    number: data.number,
    date: data.createdAt,
    items: data.items,
    discount: data.discount,
    deliveryFee: 0,
    total: data.total,
    amountPaid: data.amountPaid,
    paymentLabel: PAYMENT_METHODS[sale.paymentMethod],
  });

  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-3 text-center print:hidden">
        <span
          className={cn(
            "grid size-16 place-items-center rounded-full",
            sent ? "bg-success/10 text-success" : "bg-saffron/15 text-warning dark:text-saffron",
          )}
        >
          {sent ? <CheckCircle2 className="size-9" /> : <CloudOff className="size-9" />}
        </span>
        <h1 className="text-2xl font-semibold">{sent ? "Vente envoyée !" : "Vente enregistrée dans le téléphone"}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {sent
            ? `Elle porte maintenant le numéro ${sale.serverNumber}.`
            : "Elle sera envoyée automatiquement au retour d'internet. Le stock affiché tient déjà compte de cette vente."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <Receipt sale={data} business={business} />
        <div className="space-y-3 print:hidden">
          <Button asChild size="lg" className="w-full bg-[#25D366] text-white hover:bg-[#1fb857]">
            <a href={waLink(sale.customerPhone, message)} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Envoyer sur WhatsApp
            </a>
          </Button>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <PrintButton />
            <Button variant="saffron" onClick={onNewSale}>
              <Plus /> Nouvelle vente
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **5.6 Caisse en ligne avec bascule automatique** — `src/components/offline/online-pos.tsx` :

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomerOption } from "@/components/customers/customer-dialog";
import { PosScreen, type PosProduct } from "@/components/pos/pos-screen";
import type { ReceiptBusiness } from "@/components/sales/receipt";
import { localAvailability } from "@/lib/offline/stock";
import type { OutboxSale, SaleDraft } from "@/lib/offline/types";
import { createSale } from "@/server/actions/sales";
import { OfflineReceipt } from "./offline-receipt";
import { useOfflineMode } from "./offline-provider";

/**
 * Caisse de la page /vendre : la vente part au serveur. Si internet coupe au moment de valider, elle est gardée
 * dans le téléphone et un reçu provisoire s'affiche.
 */
export function OnlinePos({
  products,
  categories,
  customers,
  business,
  sellerName,
}: {
  products: PosProduct[];
  categories: { id: string; name: string }[];
  customers: CustomerOption[];
  business: ReceiptBusiness;
  sellerName: string;
}) {
  const router = useRouter();
  const offline = useOfflineMode();
  const [receipt, setReceipt] = useState<OutboxSale | null>(null);

  const id = offline.identity;
  const shown = id ? localAvailability(products, offline.outbox, id.businessId, id.locationId) : products;

  async function submit(draft: SaleDraft): Promise<string | null> {
    let res: Awaited<ReturnType<typeof createSale>>;
    try {
      res = await createSale({
        clientRef: draft.clientRef,
        items: draft.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        discount: draft.discount,
        customerId: draft.customer?.id ?? null,
        paymentMethod: draft.paymentMethod,
        amountReceived: draft.amountReceived,
      });
    } catch {
      // Pas de réponse du serveur : la vente est gardée dans le téléphone (même identifiant, donc jamais en double)
      try {
        setReceipt(await offline.enqueueSale(draft));
        return null;
      } catch {
        return "Pas d'internet, et la caisse hors ligne n'est pas prête. Réessayez dans un instant.";
      }
    }
    if (!res.ok) return res.error;
    void offline.refreshSnapshot(true);
    router.push(`/ventes/${res.data.id}?nouvelle=1`);
    router.refresh();
    return null;
  }

  if (receipt) {
    return <OfflineReceipt sale={receipt} business={business} sellerName={sellerName} onNewSale={() => setReceipt(null)} />;
  }
  return (
    <PosScreen
      products={shown}
      categories={categories}
      customers={customers}
      submit={submit}
      allowCustomerCreate={offline.online}
    />
  );
}
```

- [ ] **5.7 `/vendre`** — dans `src/app/(app)/vendre/page.tsx` :
  - remplacer `import { PosScreen } from "@/components/pos/pos-screen";` par
    `import { OnlinePos } from "@/components/offline/online-pos";` ;
  - remplacer `<PosScreen` par `<OnlinePos`, et ajouter les propriétés
    `business={{ name: ctx.business.name, logo: ctx.business.logo, address: ctx.business.address, city: ctx.business.city, phone: ctx.business.phone }}`
    et `sellerName={ctx.user.name}`.

- [ ] **5.8 Vérifier** :
  - `npx tsc --noEmit` : aucune erreur, et en particulier `ventes/[id]/page.tsx` et les commandes qui utilisent
    `Receipt` compilent toujours ;
  - `npx eslint src/components src/app` : aucune erreur.

---

### Étape 6 : La page de secours `/hors-ligne`

**Fichiers :**
- Créer : `src/app/hors-ligne/page.tsx`, `src/components/offline/offline-app.tsx`

**Interfaces :** elle utilise `OfflineProvider`, `useOfflineMode`, `OfflineBanner`, `OfflineReceipt`, `PosScreen`,
`localAvailability`, `canSellOffline`, `offlineLabel`, `saleTotals` et `brandCss`.

- [ ] **6.1 La page** — `src/app/hors-ligne/page.tsx` :

```tsx
import type { Metadata } from "next";
import { OfflineApp } from "@/components/offline/offline-app";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Caisse hors ligne", robots: NO_INDEX };

/**
 * Page statique, sans donnée serveur : le service worker la garde pour l'ouvrir sans internet. Les données viennent
 * du téléphone (copie de la caisse et ventes en attente).
 */
export default function HorsLignePage() {
  return <OfflineApp />;
}
```

- [ ] **6.2 L'application hors ligne** — `src/components/offline/offline-app.tsx` :

```tsx
"use client";

import { ArrowLeft, Clock, PackageSearch, RotateCw, ShoppingCart, Store, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { LogoMark } from "@/components/brand/logo";
import { PosScreen } from "@/components/pos/pos-screen";
import { EmptyState } from "@/components/shared/empty-state";
import { matchesSearch, SearchInput } from "@/components/shared/search-input";
import { StockBadge } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { brandCss } from "@/lib/domain/brand";
import { stockStatus } from "@/lib/domain/stock";
import { formatDateTime, formatFCFA, formatQty } from "@/lib/format";
import { canSellOffline, offlineLabel, saleTotals } from "@/lib/offline/sale";
import { localAvailability } from "@/lib/offline/stock";
import type { OfflineSnapshot, OutboxSale } from "@/lib/offline/types";
import { cn } from "@/lib/utils";
import { OfflineBanner } from "./offline-banner";
import { OfflineProvider, useOfflineMode } from "./offline-provider";
import { OfflineReceipt } from "./offline-receipt";

type Tab = "caisse" | "stock" | "attente";

const noSubscribe = () => () => {};
/** Paramètres de l'adresse, lus sans Suspense : la page reste entièrement statique. */
function useSearch(): URLSearchParams {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  return new URLSearchParams(search);
}

/** « il y a 5 min », « il y a 3 h », « il y a 2 jours ». */
function age(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} jour${days > 1 ? "s" : ""}`;
}

export function OfflineApp() {
  return (
    <OfflineProvider>
      <OfflineScreen />
    </OfflineProvider>
  );
}

function Shell({ snapshot, children }: { snapshot: OfflineSnapshot | null; children: React.ReactNode }) {
  const o = useOfflineMode();
  const css = snapshot?.business.licensed ? brandCss(snapshot.business.brandColor) : null;
  return (
    <div className="min-h-dvh bg-white dark:bg-background">
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-md dark:bg-background/90 print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          {snapshot?.business.licensed && snapshot.business.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo en data URL
            <img src={snapshot.business.logo} alt="" className="size-7 shrink-0 rounded-[9px] object-cover ring-1 ring-border" />
          ) : (
            <LogoMark className="size-7" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] font-semibold">{snapshot?.business.name ?? "Sama Stock"}</span>
            {snapshot && <span className="block truncate text-xs text-muted-foreground">{snapshot.location.name}</span>}
          </span>
          {o.online && (
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <a href="/tableau-de-bord">
                <ArrowLeft /> Revenir à l&apos;application
              </a>
            </Button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

function OfflineScreen() {
  const o = useOfflineMode();
  const params = useSearch();
  const [tab, setTab] = useState<Tab | null>(null);
  const [receipt, setReceipt] = useState<OutboxSale | null>(null);
  const [now] = useState(() => new Date());
  const from = params.get("depuis");

  if (!o.ready) {
    return (
      <Shell snapshot={null}>
        <p className="py-24 text-center text-sm text-muted-foreground">Chargement…</p>
      </Shell>
    );
  }

  const s = o.snapshot;
  if (!s) {
    return (
      <Shell snapshot={null}>
        <OfflineBanner inOfflineApp />
        <div className="mx-auto max-w-lg px-4 py-16">
          <EmptyState
            icon={Store}
            title="Le mode hors ligne n'est pas encore prêt"
            description="Ouvrez Sama Stock une fois avec internet : le téléphone gardera une copie de la caisse et du stock pour les coupures."
            action={
              o.online && (
                <Button asChild>
                  <a href="/tableau-de-bord">Ouvrir Sama Stock</a>
                </Button>
              )
            }
          />
        </div>
      </Shell>
    );
  }

  const sell = canSellOffline(s, now);
  const products = localAvailability(
    s.products.map((p) => ({ ...p, imageUrl: null })),
    o.outbox,
    s.business.id,
    s.location.id,
  );
  const tabs: { id: Tab; label: string; icon: typeof Clock }[] = [];
  if (sell) tabs.push({ id: "caisse", label: "Caisse", icon: ShoppingCart });
  if (s.can.viewStock) tabs.push({ id: "stock", label: "Stock", icon: PackageSearch });
  tabs.push({ id: "attente", label: o.summary.pending > 0 ? `En attente (${o.summary.pending})` : "En attente", icon: Clock });
  const wanted: Tab = tab ?? (params.get("onglet") === "attente" ? "attente" : "caisse");
  const active = tabs.some((t) => t.id === wanted) ? wanted : tabs[0]!.id;

  return (
    <Shell snapshot={s}>
      <OfflineBanner inOfflineApp onShowPending={() => setTab("attente")} />
      <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:px-8">
        {from && !o.online && (
          <p className="mb-4 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            Cette page a besoin d&apos;internet. En attendant, vous pouvez vendre et voir votre stock.
          </p>
        )}
        {!sell && (
          <p className="mb-4 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            La caisse n&apos;est pas disponible hors ligne pour votre compte ou votre formule.
          </p>
        )}
        <div role="tablist" aria-label="Caisse hors ligne" className="mb-5 flex gap-2 overflow-x-auto print:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active === t.id}
              onClick={() => {
                setTab(t.id);
                setReceipt(null);
              }}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium text-muted-foreground",
                active === t.id && "border-primary/30 bg-accent text-accent-foreground",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        {active === "caisse" &&
          (receipt ? (
            <OfflineReceipt sale={receipt} business={s.business} sellerName={s.user.name} onNewSale={() => setReceipt(null)} />
          ) : products.length === 0 ? (
            <EmptyState icon={PackageSearch} title="Aucun produit dans la copie" description="Ouvrez l'application avec internet pour mettre la copie à jour." />
          ) : (
            <PosScreen
              products={products}
              categories={s.categories}
              customers={s.customers}
              submit={async (draft) => {
                setReceipt(await o.enqueueSale(draft));
                return null;
              }}
              allowCustomerCreate={false}
              bottomNav={false}
            />
          ))}
        {active === "stock" && <StockList products={products} savedAt={s.savedAt} now={now} />}
        {active === "attente" && <PendingList userId={s.user.id} />}
      </main>
    </Shell>
  );
}

function StockList({
  products,
  savedAt,
  now,
}: {
  products: { id: string; name: string; unit: string; salePrice: number; available: number; alertThreshold: number }[];
  savedAt: string;
  now: Date;
}) {
  const [q, setQ] = useState("");
  const old = now.getTime() - new Date(savedAt).getTime() > 24 * 60 * 60 * 1000;
  const visible = products.filter((p) => matchesSearch(q, p.name));
  return (
    <section className="space-y-4">
      <p className={cn("text-sm", old ? "font-medium text-warning dark:text-saffron" : "text-muted-foreground")}>
        Stock mis à jour {age(savedAt, now)}. Les ventes en attente sont déjà retirées.
      </p>
      <SearchInput value={q} onChange={setQ} placeholder="Rechercher un produit…" />
      {visible.length === 0 ? (
        <EmptyState icon={PackageSearch} title="Aucun produit" description="Vérifiez l'orthographe." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visible.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="num text-xs text-muted-foreground">{formatFCFA(p.salePrice)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="num font-semibold">{formatQty(p.available, p.unit)}</span>
                <StockBadge status={stockStatus(p.available, p.alertThreshold)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const STATUS_LABELS = { pending: "En attente d'envoi", refused: "Refusée", sent: "Envoyée" } as const;

function PendingList({ userId }: { userId: string }) {
  const o = useOfflineMode();
  const mine = o.outbox.filter((s) => s.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (mine.length === 0) {
    return <EmptyState icon={Clock} title="Aucune vente en attente" description="Les ventes faites sans internet apparaîtront ici jusqu'à leur envoi." />;
  }
  return (
    <section className="space-y-3">
      {o.summary.pending > 0 && o.online && (
        <Button variant="outline" onClick={() => void o.syncNow()}>
          <RotateCw /> Envoyer maintenant
        </Button>
      )}
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {mine.map((s) => {
          const { total } = saleTotals(s.items, s.discount, s.paymentMethod, s.amountReceived);
          return (
            <li key={s.clientRef} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.serverNumber ?? offlineLabel(s.localNumber)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(s.createdAt)} · {s.items.length} article{s.items.length > 1 ? "s" : ""}
                    {s.customerName && <> · {s.customerName}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num font-semibold">{formatFCFA(total)}</p>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      s.status === "refused" ? "text-destructive" : s.status === "sent" ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {STATUS_LABELS[s.status]}
                  </p>
                </div>
              </div>
              {s.status === "refused" && (
                <div className="mt-2 rounded-lg bg-destructive/5 p-3 text-sm">
                  <p className="text-destructive">{s.error}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void o.retrySale(s.clientRef)}>
                      <RotateCw /> Réessayer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (window.confirm("Retirer cette vente du téléphone ? Elle ne sera jamais enregistrée.")) void o.removeSale(s.clientRef);
                      }}
                    >
                      <Trash2 /> Retirer
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **6.3 Vérifier** :
  - `npx tsc --noEmit` et `npx eslint src/components/offline src/app/hors-ligne` : aucune erreur ;
  - `npm run build` réussit, et la route `/hors-ligne` est marquée `○` (statique) dans le résumé.

---

### Étape 7 : Déconnexion sans perdre de ventes

**Fichiers :**
- Créer : `src/lib/offline/sign-out.ts`
- Modifier :
  - `src/components/shell/user-menu.tsx`
  - `src/components/shell/sign-out-button.tsx`
  - `src/components/demo/demo-signup-button.tsx`

**Interfaces :** elle produit `signOutSafely(): Promise<boolean>` (`false` si l'utilisateur annule).

- [ ] **7.1** — `src/lib/offline/sign-out.ts` :

```ts
import { authClient } from "@/lib/auth-client";
import { offlineDb } from "./db";

/**
 * Déconnexion qui protège les ventes faites sans internet : elles restent dans le téléphone et partiront à la
 * prochaine connexion. La copie de la caisse est effacée. Renvoie false si l'utilisateur annule.
 */
export async function signOutSafely(): Promise<boolean> {
  let waiting = 0;
  try {
    const snapshot = await offlineDb.getSnapshot();
    waiting = (await offlineDb.listOutbox()).filter((s) => s.status !== "sent" && (!snapshot || s.userId === snapshot.user.id)).length;
  } catch {
    // Pas de base locale (navigation privée) : rien à protéger
  }
  if (waiting > 0) {
    const many = waiting > 1;
    const ok = window.confirm(
      `${waiting} vente${many ? "s" : ""} ${many ? "ne sont" : "n'est"} pas encore envoyée${many ? "s" : ""}. ` +
        `${many ? "Elles resteront" : "Elle restera"} dans ce téléphone et ${many ? "partiront" : "partira"} à votre prochaine connexion.\n\n` +
        "Se déconnecter quand même ?",
    );
    if (!ok) return false;
  }
  await authClient.signOut();
  await offlineDb.clearSnapshot().catch(() => {});
  return true;
}
```

- [ ] **7.2** Dans les trois composants :
  - remplacer `await authClient.signOut();` par `if (!(await signOutSafely())) return;` ;
  - dans `SignOutButton` et `DemoSignupButton`, remettre `setPending(false)` avant ce `return` :
    `if (!(await signOutSafely())) { setPending(false); return; }` ;
  - remplacer l'import de `authClient` par `import { signOutSafely } from "@/lib/offline/sign-out";`, si `authClient`
    ne sert plus dans le fichier.

- [ ] **7.3 Vérifier** — `npx tsc --noEmit` et `npx eslint src/components/shell src/components/demo src/lib/offline` :
  aucune erreur.

---

### Étape 8 : Côté propriétaire — badge, filtre « À vérifier », détail et alerte

**Fichiers :**
- Modifier :
  - `src/server/queries/sales.ts`
  - `src/app/(app)/ventes/page.tsx`
  - `src/app/(app)/ventes/[id]/page.tsx`
  - `src/app/(app)/tableau-de-bord/page.tsx`

**Interfaces :**
- Utilise : `SYNC_FLAGS` et `isSyncFlag`.
- Produit :
  - `SALE_STATES.averifier` ;
  - les champs `offline` et `flagged` de `listSales` ;
  - `countFlaggedSales(ctx, since): Promise<number>`.

- [ ] **8.1 Requêtes** — dans `src/server/queries/sales.ts` :
  - `SALE_STATES` : ajouter `averifier: "À vérifier",` ;
  - dans `listSales`, après la ligne `annulees`, ajouter
    `if (f.state === "averifier") conditions.push(sql\`cardinality(${sales.syncFlags}) > 0\`);` ;
  - dans son `select`, ajouter `offline: sql<boolean>\`${sales.offlineSyncedAt} is not null\`,` et
    `flagged: sql<boolean>\`cardinality(${sales.syncFlags}) > 0\`,` ;
  - ajouter la fonction :

```ts
/** Ventes faites sans internet qui demandent une vérification (stock négatif, prix différent…). */
export async function countFlaggedSales(ctx: BusinessContext, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sales)
    .where(
      and(
        eq(sales.businessId, ctx.business.id),
        eq(sales.kind, "sale"),
        gte(sales.createdAt, since),
        sql`cardinality(${sales.syncFlags}) > 0`,
      ),
    );
  return row?.n ?? 0;
}
```

- [ ] **8.2 Liste des ventes** — dans `src/app/(app)/ventes/page.tsx` :
  - ajouter `CloudOff` aux imports lucide ;
  - dans le `<p className="flex flex-wrap items-center gap-2 font-semibold">` de chaque vente, après le statut annulé,
    ajouter :

```tsx
                      {s.offline && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <CloudOff className="size-3" /> Hors ligne
                        </span>
                      )}
                      {s.flagged && (
                        <span className="rounded-md bg-saffron/15 px-1.5 py-0.5 text-[11px] font-medium text-warning dark:text-saffron">
                          À vérifier
                        </span>
                      )}
```

- [ ] **8.3 Détail d'une vente** — dans `src/app/(app)/ventes/[id]/page.tsx` :
  - ajouter `CloudOff` et `TriangleAlert` aux imports lucide ;
  - ajouter `import { isSyncFlag, SYNC_FLAGS } from "@/lib/domain/offline";` ;
  - ajouter `formatDateTime` à l'import de `@/lib/format` ;
  - au début de la colonne de droite (`<div className="space-y-3 print:hidden">`), avant le bouton WhatsApp, ajouter :

```tsx
          {sale.offlineSyncedAt && (
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <CloudOff className="size-4 text-muted-foreground" /> Vendue sans internet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Envoyée le {formatDateTime(sale.offlineSyncedAt)}</p>
              {sale.syncFlags.filter(isSyncFlag).map((f) => (
                <div key={f} className="mt-3 rounded-lg bg-saffron/10 p-3">
                  <p className="flex items-center gap-1.5 font-medium text-warning dark:text-saffron">
                    <TriangleAlert className="size-4" /> {SYNC_FLAGS[f].label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{SYNC_FLAGS[f].text}</p>
                </div>
              ))}
            </div>
          )}
```

- [ ] **8.4 Tableau de bord** — dans `src/app/(app)/tableau-de-bord/page.tsx` :
  - ajouter `countFlaggedSales` à l'import depuis `@/server/queries/sales` ;
  - ajouter un 11ᵉ élément au `Promise.all` : `full ? countFlaggedSales(ctx, periodStart("7j")) : 0`, et l'appeler
    `flagged` dans la déstructuration ;
  - juste avant `<div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">`, ajouter :

```tsx
      {flagged > 0 && (
        <Link
          href="/ventes?etat=averifier&periode=7j"
          className="mb-6 flex items-center gap-3 rounded-xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-sm transition-colors hover:bg-saffron/15"
        >
          <AlertTriangle className="size-5 shrink-0 text-warning dark:text-saffron" />
          <span className="flex-1">
            <span className="font-semibold">À vérifier :</span> {flagged} vente{flagged > 1 ? "s" : ""} faite{flagged > 1 ? "s" : ""} sans
            internet {flagged > 1 ? "demandent" : "demande"} votre attention (stock négatif, prix différent…).
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
      )}
```

- [ ] **8.5 Vérifier** — `npx tsc --noEmit`, `npx eslint src` et `npx vitest run` : aucune erreur.

---

### Étape 9 : Parcours complet sur navigateur, puis contrôles finaux

**Fichiers :** script de test hors du dépôt, dans le dossier de travail temporaire :
`C:\Users\HP\AppData\Local\Temp\claude\c--Users-HP-Documents-perso-PROJECTS-Gest-Stock\4fefef57-009a-4702-955d-4a66b2959d0d\scratchpad\offline-e2e.cjs`.

- [ ] **9.1 Construire et démarrer** :
  - `npm run build` : réussi, et `/hors-ligne` est statique (`○`) ;
  - démarrer `npx next start -p 3000` en arrière-plan, après avoir vérifié qu'aucun ancien serveur n'occupe le port
    3000.

- [ ] **9.2 Écrire le script** `offline-e2e.cjs` :

```js
// Parcours hors ligne complet sur le serveur local, avec la démo Pro.
const path = require("path");
const { chromium } = require("C:/Users/HP/AppData/Roaming/npm/node_modules/n8n/node_modules/playwright-core");
const CHROME = path.join(process.env.LOCALAPPDATA, "ms-playwright/chromium-1243/chrome-win64/chrome.exe");
const BASE = process.argv[2] || "http://localhost:3000";
const OUT = process.argv[3];
const log = (...a) => console.log(...a);

async function enterDemo(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
  await page.locator("button", { hasText: /pro/i }).first().click();
  await page.waitForURL("**/tableau-de-bord", { timeout: 90_000 });
  return page;
}

/** Attend que le service worker ait gardé la caisse hors ligne et que la copie soit dans le téléphone. */
async function waitReady(page) {
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.active) return false;
      const keys = await caches.keys();
      let page = false;
      for (const k of keys) if (k.startsWith("sama-offline-") && (await (await caches.open(k)).match("/hors-ligne"))) page = true;
      if (!page) return false;
      const snap = await new Promise((resolve) => {
        const req = indexedDB.open("sama-stock", 1);
        req.onsuccess = () => {
          const g = req.result.transaction("snapshot").objectStore("snapshot").get("current");
          g.onsuccess = () => resolve(g.result ?? null);
          g.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      });
      return Boolean(snap);
    },
    null,
    { timeout: 60_000, polling: 1000 },
  );
}

async function outbox(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("sama-stock", 1);
        req.onsuccess = () => {
          const g = req.result.transaction("outbox").objectStore("outbox").getAll();
          g.onsuccess = () => resolve(g.result);
        };
      }),
  );
}

async function sellFirst(page, { all = false } = {}) {
  const product = page.locator("main ul li button:not([disabled])").first();
  const name = (await product.locator("span.line-clamp-2").innerText()).trim();
  await product.click();
  if (all) {
    const input = page.getByLabel(`Quantité de ${name}`).first();
    await input.fill("100000"); // limitée au disponible par la caisse
  }
  await page.getByRole("button", { name: /Encaisser/ }).first().click();
  await page.getByRole("button", { name: "Valider la vente" }).click();
  return name;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await enterDemo(ctxA);
  await a.goto(`${BASE}/vendre`, { waitUntil: "networkidle" });
  await waitReady(a);
  log("1. copie et page de secours prêtes : OK");

  // 2. Coupure puis ouverture d'une page : redirection vers la caisse hors ligne
  await ctxA.setOffline(true);
  await a.goto(`${BASE}/vendre`).catch(() => {});
  await a.waitForURL(/\/hors-ligne/, { timeout: 15_000 });
  await a.getByText("Pas d'internet").first().waitFor();
  log("2. sans internet → page de secours :", a.url().replace(BASE, ""));
  await a.screenshot({ path: path.join(OUT, "1-caisse-hors-ligne.png") });

  // 3. Vente hors ligne
  const sold = await sellFirst(a);
  await a.getByText("Vente enregistrée dans le téléphone").waitFor();
  await a.getByText(/Hors ligne n° \d+/).first().waitFor();
  log("3. vente hors ligne de", sold, ": reçu provisoire OK");
  await a.screenshot({ path: path.join(OUT, "2-recu-provisoire.png") });

  // 4. Rechargement toujours sans internet : la vente est gardée
  await a.goto(`${BASE}/hors-ligne?onglet=attente`).catch(() => {});
  await a.getByText("En attente d'envoi").first().waitFor();
  const before = (await outbox(a)).filter((s) => s.status === "pending");
  log("4. après rechargement hors ligne, ventes en attente :", before.length);

  // 5. Retour d'internet : envoi automatique
  await ctxA.setOffline(false);
  await a.waitForFunction(
    async (refs) =>
      new Promise((resolve) => {
        const req = indexedDB.open("sama-stock", 1);
        req.onsuccess = () => {
          const g = req.result.transaction("outbox").objectStore("outbox").getAll();
          g.onsuccess = () => resolve(g.result.filter((s) => refs.includes(s.clientRef)).every((s) => s.status === "sent"));
        };
      }),
    before.map((s) => s.clientRef),
    { timeout: 60_000, polling: 1000 },
  );
  const sent = (await outbox(a)).find((s) => s.clientRef === before[0].clientRef);
  log("5. envoyée automatiquement avec le numéro", sent.serverNumber);

  // 6. Même vente renvoyée : pas de doublon
  const replay = await a.evaluate(async (s) => {
    const body = {
      version: 1,
      sales: [
        {
          clientRef: s.clientRef,
          businessId: s.businessId,
          locationId: s.locationId,
          createdAt: s.createdAt,
          items: s.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
          discount: s.discount,
          paymentMethod: s.paymentMethod,
          amountReceived: s.amountReceived,
          customerId: s.customerId,
        },
      ],
    };
    const r = await fetch("/api/hors-ligne/ventes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }, sent);
  log("6. renvoi de la même vente →", replay.results[0].status, replay.results[0].id === sent.serverId ? "(même vente, pas de doublon)" : "(DOUBLON !)");

  // 7. La vente apparaît avec le badge « Hors ligne »
  await a.goto(`${BASE}/ventes`, { waitUntil: "networkidle" });
  log("7. badge « Hors ligne » dans la liste :", (await a.getByText("Hors ligne").count()) > 0);
  await a.screenshot({ path: path.join(OUT, "3-liste-ventes.png") });

  // 8. Coupure au moment de valider sur /vendre : bascule vers la file
  await a.goto(`${BASE}/vendre`, { waitUntil: "networkidle" });
  await ctxA.setOffline(true);
  await sellFirst(a);
  await a.getByText("Vente enregistrée dans le téléphone").waitFor({ timeout: 30_000 });
  log("8. coupure pendant la validation → vente gardée dans le téléphone : OK");
  await ctxA.setOffline(false);

  // 9. Stock négatif : A vend tout hors ligne, B vend en ligne, puis A envoie
  await a.goto(`${BASE}/vendre`, { waitUntil: "networkidle" });
  await waitReady(a);
  await ctxA.setOffline(true);
  await a.goto(`${BASE}/hors-ligne`).catch(() => {});
  const product = await sellFirst(a, { all: true });
  await a.getByText("Vente enregistrée dans le téléphone").waitFor();
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const b = await enterDemo(ctxB);
  await b.goto(`${BASE}/vendre`, { waitUntil: "networkidle" });
  await b.getByRole("button", { name: new RegExp(product.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
  await b.getByRole("button", { name: /Encaisser/ }).first().click();
  await b.getByRole("button", { name: "Valider la vente" }).click();
  await b.waitForURL("**/ventes/**", { timeout: 30_000 });
  await ctxA.setOffline(false);
  await a.waitForTimeout(8000);
  await b.goto(`${BASE}/ventes?etat=averifier&periode=7j`, { waitUntil: "networkidle" });
  log("9. vente signalée « À vérifier » :", (await b.getByText("À vérifier").count()) > 1);
  await b.goto(`${BASE}/tableau-de-bord`, { waitUntil: "networkidle" });
  log("   alerte du tableau de bord :", (await b.getByText(/demandent? votre attention/).count()) > 0);
  await b.screenshot({ path: path.join(OUT, "4-tableau-de-bord.png") });

  await browser.close();
})().catch((e) => {
  console.error("ECHEC", e.message);
  process.exit(1);
});
```

- [ ] **9.3 Lancer** :
  `node offline-e2e.cjs http://localhost:3000 "<dossier de travail temporaire>/offline-shots"`
  Attendu : les étapes 1 à 9 s'affichent sans « ECHEC », avec `ok (même vente, pas de doublon)` à l'étape 6 et `true`
  aux étapes 7 et 9. Regarder les 4 captures (téléphone et ordinateur).

- [ ] **9.4 Contrôles finaux** :
  - `npx tsc --noEmit`, `npx eslint src`, `npx vitest run` et `npm run build` : tout est vert ;
  - `curl -sI http://localhost:3000/sw.js` affiche `Cache-Control: no-cache, no-store, must-revalidate` ;
  - `git status` : seuls les fichiers prévus sont modifiés ;
  - arrêter le serveur local.

- [ ] **9.5 Mise en ligne, seulement après accord de l'utilisateur** :
  - un commit unique `feat(hors-ligne): …`, puis le push ;
  - vérifier le déploiement Vercel (`list_deployments`, ou `create_deployment` s'il manque) ;
  - refaire les étapes 1 à 7 du parcours sur `https://sama-stock-one.vercel.app` avec la démo Pro.

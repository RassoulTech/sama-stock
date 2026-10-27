import { describe, expect, it } from "vitest";
import { clampSaleDate, computeSyncFlags, FUTURE_TOLERANCE_MS, isSyncFlag } from "@/lib/domain/offline";
import { applySyncResults, outboxSummary, SENT_KEEP_MS, sentToPurge } from "./outbox";
import { buildOutboxSale, canSellOffline, mergeItems, offlineLabel, saleTotals, unexpectedPriceChange } from "./sale";
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
  it("bloque après la fin de l'essai gratuit, même sans réseau", () => {
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

describe("prix négociés à la caisse", () => {
  const prices = new Map([
    ["p1", 1000],
    ["p2", 2500],
  ]);
  it("un prix négocié n'est pas un « prix différent »", () => {
    expect(unexpectedPriceChange([{ productId: "p1", unitPrice: 800, negotiated: true }], prices)).toBe(false);
  });
  it("un prix qui a changé depuis la vente est signalé", () => {
    expect(unexpectedPriceChange([{ productId: "p2", unitPrice: 2000 }], prices)).toBe(true);
    expect(unexpectedPriceChange([{ productId: "p2", unitPrice: 2500 }], prices)).toBe(false);
  });
  it("le regroupement garde la négociation et le format d'envoi la transporte", () => {
    const merged = mergeItems([
      { productId: "p1", name: "A", unit: "piece", quantity: 1, unitPrice: 800, negotiated: true },
      { productId: "p1", name: "A", unit: "piece", quantity: 2, unitPrice: 800 },
    ]);
    expect(merged).toEqual([{ productId: "p1", name: "A", unit: "piece", quantity: 3, unitPrice: 800, negotiated: true }]);
    const input = toSyncInput({ ...sale(), items: merged });
    expect(input.items[0]).toEqual({ productId: "p1", quantity: 3, unitPrice: 800, negotiated: true });
    expect(offlineSaleInputSchema.safeParse(input).success).toBe(true);
    // Une vente gardée par une ancienne version (sans le champ) reste acceptée
    const old = { ...input, items: [{ productId: "p1", quantity: 3, unitPrice: 800 }] };
    expect(offlineSaleInputSchema.safeParse(old).success).toBe(true);
  });
});

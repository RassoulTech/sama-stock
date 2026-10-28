import { describe, expect, it } from "vitest";
import { allocatePayment, paymentReversal } from "./payments";

describe("allocatePayment", () => {
  it("rembourse les ventes les plus anciennes d'abord", () => {
    const unpaid = [
      { id: "a", total: 5000, amountPaid: 2000 },
      { id: "b", total: 4000, amountPaid: 0 },
    ];
    expect(allocatePayment(5000, unpaid)).toEqual([
      { saleId: "a", amount: 3000 },
      { saleId: "b", amount: 2000 },
    ]);
  });
});

describe("paymentReversal", () => {
  const sales = [
    { id: "cash", amountPaid: 3000, credit: false, completedAt: "2026-10-20" },
    { id: "old", amountPaid: 4000, credit: true, completedAt: "2026-10-01" },
    { id: "new", amountPaid: 1000, credit: true, completedAt: "2026-10-10" },
  ];

  it("avec répartition : retire exactement ce qui avait été imputé", () => {
    expect(paymentReversal(2500, [{ saleId: "old", amount: 2500 }], sales)).toEqual([{ saleId: "old", amount: 2500 }]);
  });

  it("ignore une vente annulée depuis", () => {
    expect(paymentReversal(2500, [{ saleId: "gone", amount: 2500 }], sales)).toEqual([]);
  });

  it("sans répartition : ventes à crédit d'abord, des plus récentes aux plus anciennes", () => {
    expect(paymentReversal(3000, null, sales)).toEqual([
      { saleId: "new", amount: 1000 },
      { saleId: "old", amount: 2000 },
    ]);
  });
});

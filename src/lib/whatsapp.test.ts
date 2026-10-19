import { describe, expect, it } from "vitest";
import {
  debtReminderMessage,
  invitationMessage,
  orderMessage,
  receiptMessage,
  waLink,
} from "./whatsapp";

describe("waLink", () => {
  it("targets the number without + and encodes the text", () => {
    expect(waLink("+221771234567", "Bonjour à vous")).toBe(
      "https://wa.me/221771234567?text=Bonjour%20%C3%A0%20vous",
    );
  });
  it("lets the user pick a contact when there is no number", () => {
    expect(waLink(null, "Salut")).toBe("https://wa.me/?text=Salut");
  });
});

describe("receiptMessage", () => {
  const msg = receiptMessage({
    businessName: "Boutique Awa",
    number: "V-0042",
    date: new Date("2026-10-19T10:00:00Z"),
    items: [
      { name: "Sac de ciment", quantity: 2, unit: "sac", lineTotal: 9000 },
      { name: "Câble", quantity: 2.5, unit: "m", lineTotal: 3500 },
    ],
    discount: 0,
    deliveryFee: 0,
    total: 12500,
    amountPaid: 10000,
    paymentLabel: "Wave",
  });
  it("lists items, totals and remaining balance", () => {
    expect(msg).toContain("*Boutique Awa*");
    expect(msg).toContain("Reçu V-0042");
    expect(msg).toContain("2 sacs × Sac de ciment");
    expect(msg).toContain("2,5 m × Câble");
    expect(msg).toContain("Total : 12 500 FCFA");
    expect(msg).toContain("Payé (Wave) : 10 000 FCFA");
    expect(msg).toContain("Reste à payer : 2 500 FCFA");
  });
  it("omits the remaining line when fully paid", () => {
    const paid = receiptMessage({
      businessName: "B",
      number: "V-1",
      date: new Date(),
      items: [],
      discount: 0,
      deliveryFee: 0,
      total: 1000,
      amountPaid: 1000,
      paymentLabel: "Espèces",
    });
    expect(paid).not.toContain("Reste à payer");
  });
});

describe("orderMessage", () => {
  it("mentions the order number, status and delivery fee", () => {
    const msg = orderMessage({
      businessName: "Awa Mode",
      customerName: "Fatou",
      number: "C-0007",
      statusLabel: "En préparation",
      items: [{ name: "Robe wax", quantity: 1, unit: "piece", lineTotal: 15000 }],
      deliveryFee: 1500,
      total: 16500,
      amountPaid: 0,
      deliveryAddress: "Parcelles U17",
    });
    expect(msg).toContain("Bonjour Fatou");
    expect(msg).toContain("C-0007");
    expect(msg).toContain("En préparation");
    expect(msg).toContain("Livraison : 1 500 FCFA");
    expect(msg).toContain("Parcelles U17");
  });
});

describe("debtReminderMessage", () => {
  it("is polite and contains the amount", () => {
    const msg = debtReminderMessage("Moussa", 2500, "Boutique Awa");
    expect(msg).toContain("Bonjour Moussa");
    expect(msg).toContain("2 500 FCFA");
    expect(msg).toContain("Boutique Awa");
  });
});

describe("invitationMessage", () => {
  it("contains the link and the role", () => {
    const msg = invitationMessage("Boutique Awa", "Vendeur", "http://x/invitation/abc");
    expect(msg).toContain("Vendeur");
    expect(msg).toContain("http://x/invitation/abc");
  });
});

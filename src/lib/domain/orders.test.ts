import { describe, expect, it } from "vitest";
import { canTransition, orderStockEffect, RESERVING_STATUSES } from "./orders";

describe("canTransition", () => {
  it("follows the order lifecycle", () => {
    expect(canTransition("new", "preparing")).toBe(true);
    expect(canTransition("new", "shipping")).toBe(true);
    expect(canTransition("new", "cancelled")).toBe(true);
    expect(canTransition("preparing", "shipping")).toBe(true);
    expect(canTransition("preparing", "cancelled")).toBe(true);
    expect(canTransition("shipping", "delivered")).toBe(true);
    expect(canTransition("shipping", "returned")).toBe(true);
  });
  it("refuses going backwards or leaving a final state", () => {
    expect(canTransition("preparing", "new")).toBe(false);
    expect(canTransition("shipping", "cancelled")).toBe(false);
    expect(canTransition("delivered", "returned")).toBe(false);
    expect(canTransition("cancelled", "new")).toBe(false);
    expect(canTransition("returned", "shipping")).toBe(false);
  });
});

describe("orderStockEffect", () => {
  it("stock leaves when the order goes out for delivery", () => {
    expect(orderStockEffect("new", "shipping")).toBe("out");
    expect(orderStockEffect("preparing", "shipping")).toBe("out");
  });
  it("stock comes back on return", () => {
    expect(orderStockEffect("shipping", "returned")).toBe("in");
  });
  it("other transitions only change the reservation", () => {
    expect(orderStockEffect("new", "preparing")).toBe("none");
    expect(orderStockEffect("preparing", "cancelled")).toBe("none");
    expect(orderStockEffect("shipping", "delivered")).toBe("none");
  });
});

describe("RESERVING_STATUSES", () => {
  it("reserves stock only before shipping", () => {
    expect([...RESERVING_STATUSES]).toEqual(["new", "preparing"]);
  });
});

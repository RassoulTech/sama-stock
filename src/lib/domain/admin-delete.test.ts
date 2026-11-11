import { describe, expect, it } from "vitest";
import { confirmationMatches, userDeletionBlocker } from "./admin-delete";

describe("confirmationMatches", () => {
  it("accepts the exact text", () => {
    expect(confirmationMatches("Boutique Test", "Boutique Test")).toBe(true);
  });
  it("ignores case and extra spaces", () => {
    expect(confirmationMatches("  boutique   test ", "Boutique Test")).toBe(true);
  });
  it("refuses a different or partial text", () => {
    expect(confirmationMatches("Boutique", "Boutique Test")).toBe(false);
    expect(confirmationMatches("Boutique Tes", "Boutique Test")).toBe(false);
  });
  it("never accepts an empty expectation", () => {
    expect(confirmationMatches("", "")).toBe(false);
    expect(confirmationMatches("  ", " ")).toBe(false);
  });
});

describe("userDeletionBlocker", () => {
  const ok = { isSelf: false, isSuperAdmin: false, ownedBusinesses: [] as string[] };

  it("allows an ordinary user who owns nothing", () => {
    expect(userDeletionBlocker(ok)).toBeNull();
  });
  it("refuses your own account", () => {
    expect(userDeletionBlocker({ ...ok, isSelf: true })).toContain("propre compte");
  });
  it("refuses an administrator account", () => {
    expect(userDeletionBlocker({ ...ok, isSuperAdmin: true })).toContain("administrateur");
  });
  it("names the commerce to delete first", () => {
    expect(userDeletionBlocker({ ...ok, ownedBusinesses: ["Boutique Test"] })).toBe(
      "Cette personne est propriétaire de « Boutique Test ». Supprimez d'abord ce commerce.",
    );
  });
  it("lists several commerces", () => {
    expect(userDeletionBlocker({ ...ok, ownedBusinesses: ["A", "B"] })).toBe(
      "Cette personne est propriétaire de « A », « B ». Supprimez d'abord ces commerces.",
    );
  });
});

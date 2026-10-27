import { describe, expect, it } from "vitest";
import { inviteDeviceToken, signDeviceInvite, verifyDeviceInvite } from "./device-invite";

const SECRET = "secret-de-test";
const now = new Date("2026-10-27T10:00:00Z");
const invite = {
  businessId: "4db17195-b4e0-44cb-ac80-451a025d0c3f",
  userId: "aZ3kLm9QpR2sT4uV",
  expiresAt: new Date("2026-10-27T10:15:00Z"),
  nonce: "n0nce-Abc_123456",
};

describe("invitation d'appareil", () => {
  it("relit un jeton valide", () => {
    const token = signDeviceInvite(SECRET, invite);
    expect(verifyDeviceInvite(SECRET, token, now)).toEqual(invite);
  });

  it("refuse un jeton expiré", () => {
    const token = signDeviceInvite(SECRET, invite);
    expect(verifyDeviceInvite(SECRET, token, new Date("2026-10-27T10:15:01Z"))).toBeNull();
  });

  it("refuse un jeton modifié ou signé avec un autre secret", () => {
    const token = signDeviceInvite(SECRET, invite);
    const other = token.replace(invite.businessId, "11111111-2222-3333-4444-555555555555");
    expect(verifyDeviceInvite(SECRET, other, now)).toBeNull();
    expect(verifyDeviceInvite("autre-secret", token, now)).toBeNull();
    // Expiration repoussée à la main : la signature ne correspond plus
    const parts = token.split(".");
    parts[2] = (parseInt(parts[2]!, 36) + 3600).toString(36);
    expect(verifyDeviceInvite(SECRET, parts.join("."), now)).toBeNull();
  });

  it("refuse les jetons mal formés", () => {
    expect(verifyDeviceInvite(SECRET, "", now)).toBeNull();
    expect(verifyDeviceInvite(SECRET, "a.b.c", now)).toBeNull();
    expect(verifyDeviceInvite(SECRET, "a.b.c.d.e", now)).toBeNull();
  });

  it("donne toujours le même jeton d'appareil pour une invitation (usage unique en base)", () => {
    expect(inviteDeviceToken(SECRET, "abc12345")).toBe(inviteDeviceToken(SECRET, "abc12345"));
    expect(inviteDeviceToken(SECRET, "abc12345")).not.toBe(inviteDeviceToken(SECRET, "abc12346"));
  });
});

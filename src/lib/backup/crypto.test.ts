import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptWithRecoveryKey, encryptForRecovery, isEncryptedBackup } from "./crypto";

const keys = () =>
  generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });

describe("copie de secours chiffrée", () => {
  const { publicKey, privateKey } = keys();
  const data = Buffer.from(JSON.stringify({ boutique: "Boutique Test", clients: ["Awa", "Moussa"] }));

  it("se relit avec la clé de secours, et seulement avec elle", () => {
    const locked = encryptForRecovery(data, publicKey);
    expect(isEncryptedBackup(locked)).toBe(true);
    expect(locked.includes(Buffer.from("Boutique Test"))).toBe(false);
    expect(decryptWithRecoveryKey(locked, privateKey).equals(data)).toBe(true);
    expect(() => decryptWithRecoveryKey(locked, keys().privateKey)).toThrow();
  });

  it("chiffre chaque fois différemment", () => {
    expect(encryptForRecovery(data, publicKey).equals(encryptForRecovery(data, publicKey))).toBe(false);
  });

  it("refuse un fichier abîmé ou qui n'est pas chiffré", () => {
    const locked = encryptForRecovery(data, publicKey);
    locked[locked.length - 1] ^= 0xff;
    expect(() => decryptWithRecoveryKey(locked, privateKey)).toThrow();
    expect(isEncryptedBackup(data)).toBe(false);
    expect(() => decryptWithRecoveryKey(data, privateKey)).toThrow("pas une copie chiffrée");
  });
});

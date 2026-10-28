import { constants, createCipheriv, createDecipheriv, privateDecrypt, publicEncrypt, randomBytes } from "node:crypto";

/**
 * Copie de secours chiffrée (GitHub) : une clé AES-256-GCM tirée au hasard pour chaque fichier, elle-même chiffrée
 * avec la clé publique de secours (RSA-OAEP, SHA-256). Seule la clé privée, gardée par le propriétaire de
 * Sama Stock hors du site, peut relire les fichiers.
 * Format : « SSENC1 » + longueur de la clé chiffrée (2 octets) + clé chiffrée + IV (12) + tag (16) + contenu.
 */
const MAGIC = Buffer.from("SSENC1");
const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" } as const;

export function isEncryptedBackup(data: Buffer): boolean {
  return data.length > MAGIC.length && data.subarray(0, MAGIC.length).equals(MAGIC);
}

export function encryptForRecovery(data: Buffer, publicKeyPem: string): Buffer {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const content = Buffer.concat([cipher.update(data), cipher.final()]);
  const lockedKey = publicEncrypt({ key: publicKeyPem, ...OAEP }, key);
  const size = Buffer.alloc(2);
  size.writeUInt16BE(lockedKey.length);
  return Buffer.concat([MAGIC, size, lockedKey, iv, cipher.getAuthTag(), content]);
}

export function decryptWithRecoveryKey(data: Buffer, privateKeyPem: string): Buffer {
  if (!isEncryptedBackup(data)) throw new Error("Ce fichier n'est pas une copie chiffrée de Sama Stock.");
  let at = MAGIC.length;
  const size = data.readUInt16BE(at);
  at += 2;
  const key = privateDecrypt({ key: privateKeyPem, ...OAEP }, data.subarray(at, at + size));
  at += size;
  const iv = data.subarray(at, at + 12);
  const tag = data.subarray(at + 12, at + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(at + 28)), decipher.final()]);
}

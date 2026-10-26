import { createHmac, timingSafeEqual } from "node:crypto";

/** Document joignable par un lien public : facture, devis ou reçu d'une vente. */
export type PublicDocKind = "facture" | "devis" | "recu";

const CODES: Record<PublicDocKind, string> = { facture: "f", devis: "d", recu: "r" };
const KINDS: Record<string, PublicDocKind> = { f: "facture", d: "devis", r: "recu" };
const ID_RE = /^[0-9a-f-]{36}$/;

function signature(secret: string, code: string, id: string): string {
  // Clé propre aux documents, dérivée du secret de l'application
  const key = createHmac("sha256", secret).update("sama-stock:documents").digest();
  return createHmac("sha256", key).update(`${code}.${id}`).digest("base64url").slice(0, 22);
}

/** Jeton du lien public et du QR code : `<type>.<id>.<signature>`. Rien à stocker, impossible à deviner. */
export function signDocumentToken(secret: string, kind: PublicDocKind, id: string): string {
  const code = CODES[kind];
  return `${code}.${id}.${signature(secret, code, id)}`;
}

export function verifyDocumentToken(secret: string, token: string): { kind: PublicDocKind; id: string } | null {
  const [code, id, sig, ...rest] = token.split(".");
  if (rest.length > 0 || !code || !id || !sig) return null;
  const kind = KINDS[code];
  if (!kind || !ID_RE.test(id)) return null;
  const expected = Buffer.from(signature(secret, code, id));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { kind, id };
}

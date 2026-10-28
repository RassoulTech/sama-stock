/**
 * Restauration totale (catastrophe) : remet toutes les boutiques et l'espace admin depuis une sauvegarde.
 *
 * Usage (base cible vide, migrations déjà appliquées avec `npx drizzle-kit migrate`) :
 *   npx tsx --conditions=react-server scripts/restaurer-tout.ts <dossier> [clé-de-secours.pem]
 *
 * <dossier> : copie GitHub décompressée (fichiers .enc, chiffrés) ou fichiers téléchargés depuis l'admin (.json.gz).
 * La clé de secours n'est demandée que pour les fichiers .enc ; par défaut :
 * ../Sama Stock - cle de secours/cle-de-secours-sauvegardes.pem
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import { decryptWithRecoveryKey, isEncryptedBackup } from "../src/lib/backup/crypto";
import type { BackupPayload, Manifest } from "../src/lib/backup/format";
import { restoreAdminPayload, restoreShopPayload, restoreUsers } from "../src/server/backup/restore";
import type { AppContext } from "../src/server/context";

const DEFAULT_KEY = path.resolve(process.cwd(), "..", "Sama Stock - cle de secours", "cle-de-secours-sauvegardes.pem");

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Indiquez le dossier de la sauvegarde.");
  const keyFile = process.argv[3] ?? DEFAULT_KEY;
  let privateKey: string | null = null;

  /** Lit un fichier du dossier, chiffré (.enc) ou non. */
  async function read(name: string): Promise<Buffer> {
    const enc = path.join(dir, `${name}.enc`);
    if (existsSync(enc)) {
      privateKey ??= await readFile(keyFile, "utf8");
      const data = await readFile(enc);
      if (!isEncryptedBackup(data)) throw new Error(`${name}.enc n'est pas chiffré comme attendu.`);
      return decryptWithRecoveryKey(data, privateKey);
    }
    return readFile(path.join(dir, name));
  }
  const load = async (p: string) => JSON.parse(gunzipSync(await read(path.basename(p))).toString("utf8")) as BackupPayload;

  const manifest = JSON.parse((await read("sommaire.json")).toString("utf8")) as Manifest;
  console.log(`Sauvegarde ${manifest.runId} : ${manifest.files.length} fichiers`);
  const adminEntry = manifest.files.find((f) => f.type === "admin");
  if (!adminEntry) throw new Error("Le fichier admin manque dans cette sauvegarde.");
  const adminPayload = await load(adminEntry.path);

  // 1. Comptes des super admins, pour signer le journal des restaurations
  await db.transaction(async (tx) => {
    await restoreUsers(tx, adminPayload);
  });
  const first = (adminPayload.tables.users ?? [])[0] as { id: string } | undefined;
  if (!first) throw new Error("Aucun compte super admin dans la sauvegarde.");
  const [u] = await db.select().from(user).where(eq(user.id, first.id));
  if (!u) throw new Error("Le compte super admin n'a pas pu être recréé.");
  const ctx = { user: { id: u.id, name: u.name, email: u.email, image: null }, isSuperAdmin: true, memberships: [], business: null } as unknown as AppContext;

  // 2. Chaque boutique, puis 3. les données admin (licences, paiements, notes, journal)
  for (const f of manifest.files.filter((f) => f.type === "boutique")) {
    await restoreShopPayload(await load(f.path), ctx);
    console.log(`✓ ${f.name}`);
  }
  await restoreAdminPayload(adminPayload, ctx);
  console.log("✓ Espace admin — restauration terminée");
  process.exit(0);
}

main().catch((e) => {
  console.error("ERREUR :", e instanceof Error ? e.message : e);
  process.exit(1);
});

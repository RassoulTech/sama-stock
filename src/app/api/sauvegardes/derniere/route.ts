import { NextResponse } from "next/server";
import { manifestPath } from "@/lib/backup/format";
import { isBackupKeyValid } from "@/server/backup/key";
import { latestNightManifest } from "@/server/backup/runs";

/**
 * Dernière sauvegarde de nuit réussie, pour la copie de secours GitHub : seulement les chemins à télécharger
 * (le sommaire lui-même, avec les noms des boutiques, est téléchargé chiffré comme les autres fichiers).
 */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const manifest = await latestNightManifest();
  if (!manifest) return NextResponse.json({ error: "Aucune sauvegarde" }, { status: 404 });
  const paths = [manifestPath(manifest.runId), ...new Set(manifest.files.map((f) => f.path))];
  return NextResponse.json({ runId: manifest.runId, paths });
}

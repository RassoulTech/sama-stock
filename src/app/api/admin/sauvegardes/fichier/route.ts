import { NextResponse } from "next/server";
import { isBackupPath } from "@/lib/backup/format";
import { backupStore } from "@/server/backup/store";
import { getContext } from "@/server/context";

/** Télécharger un fichier de sauvegarde (super admin), en clair : fichier .json.gz. */
export async function GET(request: Request) {
  const ctx = await getContext();
  if (!ctx?.isSuperAdmin) return new NextResponse(null, { status: 403 });
  const path = new URL(request.url).searchParams.get("chemin") ?? "";
  if (!isBackupPath(path)) return new NextResponse(null, { status: 400 });
  const data = await backupStore().get(path);
  if (!data) return new NextResponse(null, { status: 404 });
  const name = path.split("/").slice(-2).join("_");
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}

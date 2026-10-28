import { NextResponse } from "next/server";
import { encryptForRecovery } from "@/lib/backup/crypto";
import { isBackupPath } from "@/lib/backup/format";
import { RECOVERY_PUBLIC_KEY } from "@/lib/backup/recovery-key";
import { isBackupKeyValid } from "@/server/backup/key";
import { backupStore } from "@/server/backup/store";

/** Un fichier du coffre pour la copie de secours GitHub, toujours chiffré avec la clé de secours. */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const path = new URL(request.url).searchParams.get("chemin") ?? "";
  if (!isBackupPath(path)) return new NextResponse(null, { status: 400 });
  const data = await backupStore().get(path);
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(encryptForRecovery(data, RECOVERY_PUBLIC_KEY)), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}

import { NextResponse } from "next/server";
import { storageAlert } from "@/lib/domain/platform";
import { isBackupKeyValid } from "@/server/backup/key";
import { isGithubCopyMissing, pruneBackups, runBackup } from "@/server/backup/runs";
import { reportError } from "@/server/services/app-errors";
import { databaseUsage, nightlyCleanup } from "@/server/services/housekeeping";

export const maxDuration = 300;

/** Tâche de la nuit (planifiée par Vercel, 2 h à Dakar) : sauvegarde, ménage, surveillance de la place. */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const now = new Date();
  const result: Record<string, unknown> = {};

  try {
    const manifest = await runBackup("nuit");
    result.backup = { runId: manifest.runId, state: manifest.state, files: manifest.files.length };
    if (manifest.state !== "ok") {
      await reportError({
        source: "sauvegarde",
        route: "/api/sauvegardes/nuit",
        message: `Sauvegarde ${manifest.state === "echec" ? "ratée" : "incomplète"} : ${manifest.errors.map((e) => `${e.name} (${e.message})`).join(", ")}`,
      });
    }
    result.deleted = (await pruneBackups(now)).length;
    if (await isGithubCopyMissing(now)) {
      await reportError({ source: "sauvegarde", route: "/api/sauvegardes/nuit", message: "Aucune copie de secours GitHub depuis 2 jours" });
    }
  } catch (error) {
    await reportError({ source: "sauvegarde", route: "/api/sauvegardes/nuit", message: `Sauvegarde ratée : ${error instanceof Error ? error.message : String(error)}` });
    result.backup = "ratée";
  }

  // Le ménage et la surveillance passent même si la sauvegarde a raté
  try {
    result.cleanup = await nightlyCleanup(now);
    const usage = await databaseUsage();
    result.databaseBytes = usage.bytes;
    const alert = storageAlert(usage.bytes);
    if (alert) await reportError({ source: "plateforme", route: "/admin/sante", message: alert });
  } catch (error) {
    await reportError({ source: "plateforme", route: "/api/sauvegardes/nuit", message: `Ménage de la nuit raté : ${error instanceof Error ? error.message : String(error)}` });
  }

  return NextResponse.json(result, { status: result.backup === "ratée" ? 500 : 200 });
}

import { NextResponse } from "next/server";
import { isBackupKeyValid } from "@/server/backup/key";
import { isGithubCopyMissing, pruneBackups, runBackup } from "@/server/backup/runs";
import { reportError } from "@/server/services/app-errors";

export const maxDuration = 300;

/** Sauvegarde de la nuit (tâche planifiée Vercel, 2 h à Dakar). */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const now = new Date();
  try {
    const manifest = await runBackup("nuit");
    if (manifest.state !== "ok") {
      await reportError({ source: "sauvegarde", route: "/api/sauvegardes/nuit", message: `Sauvegarde ${manifest.state === "echec" ? "ratée" : "incomplète"} : ${manifest.errors.map((e) => `${e.name} (${e.message})`).join(", ")}` });
    }
    const deleted = await pruneBackups(now);
    if (await isGithubCopyMissing(now)) {
      await reportError({ source: "sauvegarde", route: "/api/sauvegardes/nuit", message: "Aucune copie de secours GitHub depuis 2 jours" });
    }
    return NextResponse.json({ runId: manifest.runId, state: manifest.state, files: manifest.files.length, deleted: deleted.length });
  } catch (error) {
    await reportError({ source: "sauvegarde", route: "/api/sauvegardes/nuit", message: `Sauvegarde ratée : ${error instanceof Error ? error.message : String(error)}` });
    return NextResponse.json({ error: "Sauvegarde ratée" }, { status: 500 });
  }
}

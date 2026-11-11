import { NextResponse } from "next/server";
import { voixPrete } from "@/server/assistant/voix";
import { isBackupKeyValid } from "@/server/backup/key";

export const maxDuration = 60;

/** Tâche planifiée quotidienne : garde la voix Anta éveillée (l'espace s'endort après 48 h sans usage). */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const base = process.env.ANTA_TTS_URL;
  if (!base) return NextResponse.json({ configuree: false });
  return NextResponse.json({ configuree: true, pret: await voixPrete(base, 55_000) });
}

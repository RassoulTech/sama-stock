import { NextResponse } from "next/server";
import { parseRunId } from "@/lib/backup/format";
import { isBackupKeyValid } from "@/server/backup/key";
import { markGithubCopy } from "@/server/backup/runs";

/** GitHub a fini de copier cette passe. */
export async function POST(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const runId = new URL(request.url).searchParams.get("passe") ?? "";
  if (!parseRunId(runId)) return new NextResponse(null, { status: 400 });
  return (await markGithubCopy(runId)) ? new NextResponse(null, { status: 204 }) : new NextResponse(null, { status: 404 });
}

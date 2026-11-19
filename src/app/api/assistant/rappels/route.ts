import { NextResponse } from "next/server";
import { db } from "@/db";
import { messageAssistant, rappelPour } from "@/lib/domain/assistant/abonnement";
import { isBackupKeyValid } from "@/server/backup/key";
import { finsAbonnement } from "@/server/queries/assistant";
import { notifySysteme } from "@/server/services/notifications";

export const maxDuration = 60;

/** Tâche du matin (planifiée par Vercel, 9 h à Dakar) : prévient les commerces dont l'abonnement Finch se termine. */
export async function GET(request: Request) {
  if (!isBackupKeyValid(request)) return new NextResponse(null, { status: 401 });
  const now = new Date();
  let envoyes = 0;
  for (const { businessId, finLe } of await finsAbonnement()) {
    const rappel = rappelPour(finLe, now);
    if (!rappel) continue;
    await db.transaction((tx) => notifySysteme(tx, businessId, messageAssistant(rappel, finLe)));
    envoyes++;
  }
  return NextResponse.json({ envoyes });
}

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
  // Heure prévue de la tâche (9 h UTC) et non heure réelle : un retard de Vercel ne décale pas les fenêtres de 24 h.
  const aujourdhui = new Date();
  const now = new Date(Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate(), 9));
  let envoyes = 0;
  for (const { businessId, finLe } of await finsAbonnement()) {
    try {
      const rappel = rappelPour(finLe, now);
      if (!rappel) continue;
      await db.transaction((tx) => notifySysteme(tx, businessId, messageAssistant(rappel, finLe)));
      envoyes++;
    } catch (error) {
      // Un commerce en erreur ne bloque pas les autres.
      console.error("[assistant] rappel", businessId, error);
    }
  }
  return NextResponse.json({ envoyes });
}

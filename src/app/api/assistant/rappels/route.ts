import { and, eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, type Tx } from "@/db";
import { notifications } from "@/db/schema";
import { messageAssistant, rappelPour } from "@/lib/domain/assistant/abonnement";
import type { NotifyMessage } from "@/lib/domain/notifications";
import { verrouFinch } from "@/server/assistant/verrou";
import { isBackupKeyValid } from "@/server/backup/key";
import { finsAbonnement } from "@/server/queries/assistant";
import { notifySysteme } from "@/server/services/notifications";

export const maxDuration = 60;

/**
 * Même rappel déjà envoyé à ce commerce dans les 20 dernières heures : la tâche a tourné deux fois le même jour (nouvel
 * essai de Vercel, lancement à la main). 20 h et non 24 : le rappel du lendemain part même si celui de la veille avait
 * été retardé de quelques heures.
 */
async function dejaPrevenu(tx: Tx, businessId: string, message: NotifyMessage): Promise<boolean> {
  const [n] = await tx
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.businessId, businessId),
        eq(notifications.kind, message.kind),
        eq(notifications.title, message.title),
        gt(notifications.createdAt, sql`now() - interval '20 hours'`),
      ),
    )
    .limit(1);
  return Boolean(n);
}

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
      const message = messageAssistant(rappel, finLe);
      const envoye = await db.transaction(async (tx) => {
        // Verrou : deux tâches lancées en même temps ne passent pas toutes les deux la vérification.
        await verrouFinch(tx, businessId);
        if (await dejaPrevenu(tx, businessId, message)) return false;
        await notifySysteme(tx, businessId, message);
        return true;
      });
      if (envoye) envoyes++;
    } catch (error) {
      // Un commerce en erreur ne bloque pas les autres.
      console.error("[assistant] rappel", businessId, error);
    }
  }
  return NextResponse.json({ envoyes });
}

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { syncRequestSchema } from "@/lib/offline/schema";
import type { SyncResult } from "@/lib/offline/types";
import { getSession } from "@/server/context";
import { recordOfflineSale } from "@/server/services/offline-sales";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Reçoit les ventes faites sans internet. Une adresse fixe et non une Server Action : l'identifiant d'une Server
 * Action change à chaque mise en ligne, alors qu'une vente gardée par une ancienne version doit rester envoyable.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Votre session a expiré. Reconnectez-vous." }, { status: 401, headers: NO_STORE });
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400, headers: NO_STORE });
  }
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Format de vente invalide." }, { status: 400, headers: NO_STORE });

  const user = { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null };
  const results: SyncResult[] = [];
  // Une par une : chaque vente a sa transaction et son numéro, une vente refusée ne bloque pas les autres
  for (const sale of parsed.data.sales) results.push(await recordOfflineSale(user, sale));
  if (results.some((r) => r.status === "ok")) revalidatePath("/", "layout");
  return NextResponse.json({ results }, { headers: NO_STORE });
}

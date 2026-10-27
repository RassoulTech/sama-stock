import { NextResponse } from "next/server";
import { getContext, type BusinessContext } from "@/server/context";
import { listNotifications } from "@/server/queries/notifications";

const NO_STORE = { "Cache-Control": "no-store" };

/** Dernières notifications (lues régulièrement par la cloche tant que l'application est ouverte). */
export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Votre session a expiré. Reconnectez-vous." }, { status: 401, headers: NO_STORE });
  if (!ctx.business) return NextResponse.json({ error: "Aucun commerce sélectionné." }, { status: 409, headers: NO_STORE });
  return NextResponse.json(await listNotifications(ctx as BusinessContext), { headers: NO_STORE });
}

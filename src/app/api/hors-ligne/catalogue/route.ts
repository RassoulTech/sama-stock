import { NextResponse } from "next/server";
import { getContext, type BusinessContext } from "@/server/context";
import { offlineSnapshot } from "@/server/queries/offline";

const NO_STORE = { "Cache-Control": "no-store" };

/** Copie de la caisse (produits, prix, stock, clients) gardée par le téléphone pour vendre sans internet. */
export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Votre session a expiré. Reconnectez-vous." }, { status: 401, headers: NO_STORE });
  if (!ctx.business) return NextResponse.json({ error: "Aucun commerce sélectionné." }, { status: 409, headers: NO_STORE });
  return NextResponse.json(await offlineSnapshot(ctx as BusinessContext), { headers: NO_STORE });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { contexteAssistant, dependancesOutils, NO_STORE, outilsDirects, refuser } from "@/server/assistant/contexte";
import { executerOutil } from "@/server/assistant/outils";
import { listProducts } from "@/server/queries/products";

const bodySchema = z.object({
  name: z.string().min(1).max(60),
  args: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Outil demandé par l'assistant pendant une conversation en direct. Les droits sont revérifiés ici (le téléphone
 * ne fait que relayer) ; rien n'est enregistré : un brouillon devient une mission jouée à l'écran.
 */
export async function POST(request: Request) {
  const verif = await contexteAssistant();
  if (!verif.ok) return verif.reponse;
  const { ctx } = verif;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refuser("Demande invalide.", 400);

  const products = await listProducts(ctx);
  const resultat = await executerOutil(parsed.data.name, parsed.data.args, new Set(outilsDirects(ctx)), dependancesOutils(ctx, products));
  return NextResponse.json(resultat, { headers: NO_STORE });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { voixPrete } from "@/server/assistant/voix";
import { getContext, type BusinessContext } from "@/server/context";

/** La voix Anta (serveur gratuit) peut mettre jusqu'à 60 s, surtout au réveil. */
export const maxDuration = 90;

const NO_STORE = { "Cache-Control": "no-store" };
const bodySchema = z.object({ texte: z.string().trim().min(1).max(800) });

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/** Relaie le texte de la réponse vers la copie de la voix Anta (Hugging Face) et renvoie le WAV. */
export async function POST(request: Request) {
  const app = await getContext();
  if (!app?.business) return fail("Votre session a expiré. Reconnectez-vous.", 401);
  const ctx = app as BusinessContext;
  if (ctx.plan.status === "suspended") return fail("Ce commerce est suspendu. Contactez Sama Stock.", 403);
  if (!ctx.business.assistantEnabled) return fail("L'assistant vocal n'est pas activé pour ce commerce.", 403);
  const base = process.env.ANTA_TTS_URL;
  if (!base) return fail("Voix wolof non configurée.", 503);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Texte invalide.", 400);

  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: parsed.data.texte }),
      signal: AbortSignal.timeout(60_000),
      redirect: "error",
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("audio/")) return fail("Voix indisponible.", 502);
    return new Response(res.body, { headers: { "Content-Type": type, ...NO_STORE } });
  } catch {
    return fail("Voix indisponible.", 504);
  }
}

/** Réveil de la voix, demandé par le téléphone à l'ouverture de l'assistant (il n'attend pas la réponse). */
export async function GET() {
  const app = await getContext();
  if (!app?.business) return fail("Votre session a expiré. Reconnectez-vous.", 401);
  const base = process.env.ANTA_TTS_URL;
  if (!base) return NextResponse.json({ configuree: false, pret: false }, { headers: NO_STORE });
  return NextResponse.json({ configuree: true, pret: await voixPrete(base, 5_000) }, { headers: NO_STORE });
}

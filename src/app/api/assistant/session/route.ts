import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/domain/assistant/prompt";
import { toolDeclarations } from "@/lib/domain/assistant/tools";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { contexteAssistant, NO_STORE, outilsDirects, refuser } from "@/server/assistant/contexte";
import { creerJetonDirect } from "@/server/assistant/direct";
import { GeminiError } from "@/server/assistant/gemini";
import { consumeAssistantQuota } from "@/server/assistant/usage";
import { listProducts } from "@/server/queries/products";

/**
 * Ouvre une conversation en direct : clé temporaire à usage unique qui fige le modèle, la voix, les consignes
 * (catalogue compris) et les outils autorisés pour ce rôle. Une conversation compte pour une demande du jour.
 */
export async function POST() {
  const verif = await contexteAssistant();
  if (!verif.ok) return verif.reponse;
  const { ctx } = verif;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return refuser("L'assistant vocal n'est pas encore configuré.", 503);

  const [quota, products] = await Promise.all([consumeAssistantQuota(ctx.business.id, { isDemo: ctx.business.isDemo }), listProducts(ctx)]);
  if (!quota.allowed) return refuser("Limite du jour atteinte, réessaie demain.", 429);

  const system = buildSystemPrompt({ businessName: ctx.business.name, roleLabel: ROLE_LABELS[ctx.role], today: new Date(), products, mode: "conversation" });
  const tools = toolDeclarations(outilsDirects(ctx), { costs: ctx.can("costs.view") });
  try {
    const session = await creerJetonDirect({
      apiKey,
      system,
      tools,
      model: process.env.GEMINI_LIVE_MODEL || undefined,
      voice: process.env.GEMINI_LIVE_VOICE || undefined,
    });
    return NextResponse.json(session, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof GeminiError) {
      console.error("[assistant] session", error.kind, error.status ?? "-");
      return refuser("L'assistant est saturé, réessaie dans une minute.", 503);
    }
    throw error;
  }
}

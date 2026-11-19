import { NextResponse } from "next/server";
import { ficheAssistant } from "@/lib/domain/assistant/abonnement";
import { buildSystemPrompt } from "@/lib/domain/assistant/prompt";
import { toolDeclarations } from "@/lib/domain/assistant/tools";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { LEGAL } from "@/lib/legal";
import { ouvrirConversation, prevenirSiPeuDeCredits, rendreCredit } from "@/server/assistant/abonnement";
import { accesEcrans, contexteAssistant, NO_STORE, outilsDirects, refuser } from "@/server/assistant/contexte";
import { creerJetonDirect, GeminiError } from "@/server/assistant/direct";
import { consumeAssistantQuota } from "@/server/assistant/usage";
import { listProducts } from "@/server/queries/products";

/**
 * Ouvre une conversation en direct : un crédit est retiré (abonnement ou essai ; rien pour une démonstration), puis une
 * clé temporaire à usage unique fige le modèle, la voix, les consignes (catalogue compris) et les outils du rôle.
 * Si Google refuse ou si la limite de sécurité du jour est atteinte, le crédit revient.
 */
export async function POST() {
  const verif = await contexteAssistant();
  if (!verif.ok) return verif.reponse;
  const { ctx } = verif;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return refuser("L'assistant vocal n'est pas encore configuré.", 503);

  const ouverture = await ouvrirConversation(ctx);
  if (!ouverture.ok) {
    const fiche = ficheAssistant(ouverture.etat, { boutique: ctx.business.name, peutPayer: ctx.can("billing.manage"), support: LEGAL.whatsapp });
    return NextResponse.json({ error: fiche?.titre ?? "Finch n'est pas disponible.", fiche }, { status: 402, headers: NO_STORE });
  }

  const [quota, products] = await Promise.all([consumeAssistantQuota(ctx.business.id, { isDemo: ctx.business.isDemo }), listProducts(ctx)]);
  if (!quota.allowed) {
    await rendreCredit(ouverture.moisId);
    return refuser("Limite du jour atteinte, réessaie demain.", 429);
  }

  const system = buildSystemPrompt({
    businessName: ctx.business.name,
    roleLabel: ROLE_LABELS[ctx.role],
    today: new Date(),
    products,
    acces: accesEcrans(ctx),
  });
  const tools = toolDeclarations(outilsDirects(ctx), { costs: ctx.can("costs.view") });
  try {
    const session = await creerJetonDirect({
      apiKey,
      system,
      tools,
      model: process.env.GEMINI_LIVE_MODEL || undefined,
      voice: process.env.GEMINI_LIVE_VOICE || undefined,
    });
    await prevenirSiPeuDeCredits(ctx, ouverture);
    const credits = ouverture.restants === null ? null : { restants: ouverture.restants, essai: ouverture.genre === "essai" };
    return NextResponse.json({ ...session, credits }, { headers: NO_STORE });
  } catch (error) {
    await rendreCredit(ouverture.moisId);
    if (error instanceof GeminiError) {
      console.error("[assistant] session", error.kind, error.status ?? "-");
      return refuser("L'assistant est saturé, réessaie dans une minute.", 503);
    }
    throw error;
  }
}

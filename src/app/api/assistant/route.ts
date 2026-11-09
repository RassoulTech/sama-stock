import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDraft, type DraftCatalog } from "@/lib/domain/assistant/drafts";
import { buildSystemPrompt } from "@/lib/domain/assistant/prompt";
import { allowedTools, toolDeclarations } from "@/lib/domain/assistant/tools";
import { ROLE_LABELS } from "@/lib/domain/permissions";
import { createGemini, GeminiError } from "@/server/assistant/gemini";
import { createReaders, loadDraftCatalog } from "@/server/assistant/readers";
import { AssistantError, runAssistant } from "@/server/assistant/run";
import { consumeAssistantQuota } from "@/server/assistant/usage";
import { getContext, type BusinessContext } from "@/server/context";
import { listProducts } from "@/server/queries/products";

/** Au plus 4 appels à Gemini de 30 s chacun. */
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "no-store" };
/** 30 s de WAV 16 kHz mono ≈ 960 Ko ≈ 1,3 Mo en base64. */
const MAX_AUDIO_BASE64 = 2_000_000;

const bodySchema = z.object({
  audio: z.string().min(1000).max(MAX_AUDIO_BASE64),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(800) }))
    .max(10)
    .default([]),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/** Une demande vocale : audio du commerçant → réponse (et brouillon éventuel). Rien n'est enregistré ici. */
export async function POST(request: Request) {
  const app = await getContext();
  if (!app) return fail("Votre session a expiré. Reconnectez-vous.", 401);
  if (!app.business) return fail("Aucun commerce sélectionné.", 409);
  const ctx = app as BusinessContext;
  if (ctx.plan.status === "suspended") return fail("Ce commerce est suspendu. Contactez Sama Stock.", 403);
  if (!ctx.business.assistantEnabled) return fail("L'assistant vocal n'est pas activé pour ce commerce.", 403);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail("L'assistant vocal n'est pas encore configuré.", 503);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Enregistrement invalide. Réessaie.", 400);

  const quota = await consumeAssistantQuota(ctx.business.id);
  if (!quota.allowed) return fail("Limite du jour atteinte, réessaie demain.", 429);

  const products = await listProducts(ctx);
  const costs = ctx.can("costs.view");
  const tools = toolDeclarations(
    allowedTools({ can: ctx.can, modulePos: ctx.business.modulePos, moduleOrders: ctx.business.moduleOrders }),
    { costs },
  );
  const system = buildSystemPrompt({ businessName: ctx.business.name, roleLabel: ROLE_LABELS[ctx.role], today: new Date(), products });
  let catalog: Promise<DraftCatalog> | null = null;

  try {
    const reply = await runAssistant(
      { system, history: parsed.data.history, audio: { mimeType: "audio/wav", data: parsed.data.audio }, tools },
      {
        gemini: createGemini({ apiKey, model: process.env.GEMINI_MODEL || undefined }),
        read: createReaders(ctx, products),
        draft: async (name, args) => buildDraft(name, args, await (catalog ??= loadDraftCatalog(ctx, products)), { costs }),
      },
    );
    return NextResponse.json(reply, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AssistantError) return fail(error.message, 422);
    if (error instanceof GeminiError) {
      // Jamais error.message : il peut contenir ce que Gemini a renvoyé (donc des extraits de la demande).
      if (error.kind !== "quota") console.error("[assistant] gemini", error.kind, error.status ?? "-");
      return fail("L'assistant est saturé, réessaie dans une minute.", 503);
    }
    throw error;
  }
}

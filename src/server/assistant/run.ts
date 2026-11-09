// Pas de "server-only" : les dépendances (Gemini, base) sont injectées, ce qui rend la boucle testable.
import { z } from "zod";
import { draftForModel, type Draft, type DraftResult } from "@/lib/domain/assistant/drafts";
import type { AssistantReply, HistoryItem } from "@/lib/domain/assistant/reply";
import { isDraftTool, isReadTool, LANGS, type DraftToolName, type FunctionDeclaration, type ReadToolName } from "@/lib/domain/assistant/tools";
import type { GeminiCall, GeminiContent, GeminiPart } from "./gemini";

/** 3 tours d'outils au plus, puis la réponse finale. */
export const MAX_GEMINI_CALLS = 4;

export const USER_INSTRUCTION = "Note vocale du commerçant ci-dessus. Réponds à sa demande avec les outils, puis termine par « repondre ».";

const NOT_UNDERSTOOD = "Je n'ai pas compris, peux-tu répéter ?";

export class AssistantError extends Error {
  constructor(message = NOT_UNDERSTOOD) {
    super(message);
    this.name = "AssistantError";
  }
}

export interface RunInput {
  system: string;
  history: HistoryItem[];
  audio: { mimeType: string; data: string };
  tools: FunctionDeclaration[];
}

export interface RunDeps {
  gemini: GeminiCall;
  read: (name: ReadToolName, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  draft: (name: DraftToolName, args: Record<string, unknown>) => Promise<DraftResult> | DraftResult;
}

const finalArgs = z.object({
  transcription: z.string().trim().default(""),
  langue: z.enum(LANGS),
  texte: z.string().trim().min(1).max(800),
});

type CallPart = GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> };

/** Les 5 derniers échanges (10 messages), en texte, placés avant l'audio de la nouvelle demande. */
export function historyText(history: HistoryItem[]): string | null {
  const recent = history.slice(-10);
  if (!recent.length) return null;
  return `Échanges précédents :\n${recent.map((h) => `${h.role === "user" ? "Commerçant" : "Assistant"} : ${h.text}`).join("\n")}`;
}

export async function runAssistant(input: RunInput, deps: RunDeps): Promise<AssistantReply> {
  const allowed = new Set<string>(input.tools.map((t) => t.name));
  const intro = historyText(input.history);
  const contents: GeminiContent[] = [
    { role: "user", parts: [...(intro ? [{ text: intro }] : []), { inlineData: input.audio }, { text: USER_INSTRUCTION }] },
  ];
  let draft: Draft | null = null;

  for (let i = 0; i < MAX_GEMINI_CALLS; i++) {
    const content = await deps.gemini({ system: input.system, contents, tools: input.tools });
    const calls = content.parts.filter((p): p is CallPart => Boolean(p.functionCall));
    if (!calls.length) throw new AssistantError();

    const others = calls.filter((c) => c.functionCall.name !== "repondre");
    if (!others.length) {
      const parsed = finalArgs.safeParse(calls[0].functionCall.args ?? {});
      if (!parsed.success) throw new AssistantError();
      return { ...parsed.data, brouillon: draft };
    }

    // Chaque appel de la réponse du modèle reçoit sa functionResponse, dans le même ordre.
    // « repondre » mêlé à d'autres appels est ignoré : sa réponse n'a pas encore vu les résultats.
    const responses: GeminiPart[] = [];
    for (const { functionCall } of calls) {
      const { name } = functionCall;
      const args = functionCall.args ?? {};
      let response: Record<string, unknown>;
      if (name === "repondre") {
        response = { ok: false, message: "Réponse finale ignorée : réponds avec « repondre » après avoir lu les résultats des autres outils." };
      } else if (!allowed.has(name)) {
        response = { erreur: "Outil non autorisé pour cet utilisateur." };
      } else if (isReadTool(name)) {
        response = await deps.read(name, args);
      } else if (isDraftTool(name)) {
        const result = await deps.draft(name, args);
        if (result.ok) {
          draft = result.draft;
          response = { ok: true, brouillon: draftForModel(result.draft), message: "Brouillon affiché : le commerçant doit appuyer sur Valider." };
        } else {
          response = { ok: false, raison: result.reason, ...(result.candidates ? { candidats: result.candidates } : {}) };
        }
      } else {
        response = { erreur: "Outil inconnu." };
      }
      responses.push({ functionResponse: { name, response } });
    }
    contents.push(content, { role: "user", parts: responses });
  }
  throw new AssistantError();
}

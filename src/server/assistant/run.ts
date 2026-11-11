// Pas de "server-only" : les dépendances (Gemini, base) sont injectées, ce qui rend la boucle testable.
import { z } from "zod";
import type { Confirmation, Mission } from "@/lib/domain/assistant/mission";
import type { AssistantReply, HistoryItem } from "@/lib/domain/assistant/reply";
import { LANGS, type FunctionDeclaration } from "@/lib/domain/assistant/tools";
import type { GeminiCall, GeminiContent, GeminiPart } from "./gemini";
import { executerOutil, type OutilDeps } from "./outils";

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
  /** Tâche remplie à l'écran qui attend le « oui » du commerçant (texte de missionForModel). */
  attente?: string | null;
}

export interface RunDeps extends OutilDeps {
  gemini: GeminiCall;
}

const MAX_TEXT = 800;
/** Un texte trop long est coupé plutôt que refusé : sinon le panneau reste bloqué sur « Je n'ai pas compris ». */
const clipped = (value: string) => value.trim().slice(0, MAX_TEXT);
const finalArgs = z.object({
  transcription: z.string().default("").transform(clipped),
  langue: z.enum(LANGS),
  texte: z.string().transform(clipped).pipe(z.string().min(1)),
});
const confirmArgs = z.object({ reponse: z.enum(["oui", "non"]) });

type CallPart = GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> };

/** Les 5 derniers échanges (10 messages), en texte, placés avant l'audio de la nouvelle demande. */
export function historyText(history: HistoryItem[]): string | null {
  const recent = history.slice(-10);
  if (!recent.length) return null;
  return `Échanges précédents :\n${recent.map((h) => `${h.role === "user" ? "Commerçant" : "Assistant"} : ${h.text}`).join("\n")}`;
}

export function attenteText(attente: string): string {
  return [
    `Tâche remplie à l'écran, en attente de l'accord du commerçant : ${attente}`,
    "S'il dit oui (waaw, oui, bind ko, def ko) ou non (déedéet, non, bayyil), appelle « confirmer ».",
    "S'il corrige quelque chose, appelle le même outil de brouillon avec la tâche entière corrigée.",
  ].join("\n");
}

export async function runAssistant(input: RunInput, deps: RunDeps): Promise<AssistantReply> {
  const allowed = new Set<string>(input.tools.map((t) => t.name));
  const intro = [historyText(input.history), input.attente ? attenteText(input.attente) : null].filter((t): t is string => Boolean(t));
  const contents: GeminiContent[] = [
    { role: "user", parts: [...intro.map((text) => ({ text })), { inlineData: input.audio }, { text: USER_INSTRUCTION }] },
  ];
  let mission: Mission | null = null;
  let confirmation: Confirmation | null = null;
  const done = (args: z.infer<typeof finalArgs>): AssistantReply => ({ ...args, mission, confirmation });

  for (let i = 0; i < MAX_GEMINI_CALLS; i++) {
    const content = await deps.gemini({ system: input.system, contents, tools: input.tools });
    const calls = content.parts.filter((p): p is CallPart => Boolean(p.functionCall));
    if (!calls.length) throw new AssistantError();

    const others = calls.filter((c) => c.functionCall.name !== "repondre");
    if (!others.length) {
      const parsed = finalArgs.safeParse(calls[0].functionCall.args ?? {});
      if (!parsed.success) throw new AssistantError();
      return done(parsed.data);
    }

    // Les appels du tour (sauf « repondre ») sont exécutés ; « réglé » = mission valide ou accord reçu
    const results = new Map<CallPart, Record<string, unknown>>();
    let allSettled = true;
    for (const part of others) {
      const { name } = part.functionCall;
      const args = part.functionCall.args ?? {};
      let response: Record<string, unknown>;
      let settled = false;
      if (name === "confirmer" && allowed.has(name)) {
        const parsed = confirmArgs.safeParse(args);
        if (parsed.success) {
          confirmation = parsed.data.reponse;
          settled = true;
          response = { ok: true };
        } else {
          response = { ok: false, raison: "La réponse doit être oui ou non." };
        }
      } else {
        const resultat = await executerOutil(name, args, allowed, deps);
        response = resultat.reponse;
        if (resultat.mission) {
          mission = resultat.mission;
          settled = true;
          response = {
            ...response,
            message:
              resultat.mission.type === "tache"
                ? "Tâche lancée à l'écran : l'assistant remplit le formulaire puis demande au commerçant s'il peut enregistrer."
                : "Écran ouvert devant le commerçant.",
          };
        }
      }
      if (!settled) allSettled = false;
      results.set(part, response);
    }

    // Chemin rapide : mission ou accord valides + réponse finale dans le même tour → pas de second appel.
    const finalCall = calls.find((c) => c.functionCall.name === "repondre");
    if (finalCall && allSettled) {
      const parsed = finalArgs.safeParse(finalCall.functionCall.args ?? {});
      if (parsed.success) return done(parsed.data);
    }

    // Sinon chaque appel reçoit sa functionResponse, dans le même ordre ; « repondre » est ignoré
    // (sa phrase n'a pas encore vu les résultats d'une lecture ou d'un refus).
    const responses: GeminiPart[] = calls.map((part) => ({
      functionResponse: {
        ...(part.functionCall.id ? { id: part.functionCall.id } : {}),
        name: part.functionCall.name,
        response:
          part.functionCall.name === "repondre"
            ? { ok: false, message: "Réponse finale ignorée : réponds avec « repondre » après avoir lu les résultats des autres outils." }
            : results.get(part)!,
      },
    }));
    contents.push(content, { role: "user", parts: responses });
  }
  throw new AssistantError();
}

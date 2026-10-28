import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { reportError } from "@/server/services/app-errors";

const reportSchema = z.object({
  message: z.string().min(1).max(500),
  path: z.string().max(300),
});

/** Panne vue dans le navigateur (page d'erreur affichée). Publique : la page d'erreur peut s'afficher sans connexion. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 2048) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  after(() => reportError({ source: "navigateur", route: parsed.data.path, message: parsed.data.message }));
  return new Response(null, { status: 204 });
}

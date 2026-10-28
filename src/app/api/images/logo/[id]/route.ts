import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";

/**
 * Logo d'un commerce. Public : il s'affiche déjà sur la page de connexion de la boutique.
 * L'adresse contient une empreinte du logo (?v=…) : le navigateur peut le garder en cache un an.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select({ logo: businesses.logo }).from(businesses).where(eq(businesses.id, id));
  const match = row?.logo ? /^data:(image\/[a-z+]+);base64,(.+)$/.exec(row.logo) : null;
  if (!match) return new Response("Introuvable", { status: 404 });
  return new Response(Buffer.from(match[2]!, "base64"), {
    headers: { "Content-Type": match[1]!, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

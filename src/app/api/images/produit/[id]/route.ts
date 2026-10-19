import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getContext } from "@/server/context";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx?.business) return new Response("Non autorisé", { status: 401 });

  const [row] = await db
    .select({ imageData: products.imageData })
    .from(products)
    .where(and(eq(products.id, id), eq(products.businessId, ctx.business.id)));
  const match = row?.imageData ? /^data:(image\/[a-z]+);base64,(.+)$/.exec(row.imageData) : null;
  if (!match) return new Response("Introuvable", { status: 404 });

  return new Response(Buffer.from(match[2]!, "base64"), {
    headers: {
      "Content-Type": match[1]!,
      // L'URL contient la date de modification : on peut mettre en cache longtemps
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { businesses } from "@/db/schema";

/** Numéro suivant (V-0001 pour les ventes, C-0001 pour les commandes), unique par commerce. */
export async function nextNumber(tx: Tx, businessId: string, kind: "sale" | "order"): Promise<string> {
  const column = kind === "sale" ? businesses.saleCounter : businesses.orderCounter;
  const [row] = await tx
    .update(businesses)
    .set(kind === "sale" ? { saleCounter: sql`${column} + 1` } : { orderCounter: sql`${column} + 1` })
    .where(eq(businesses.id, businessId))
    .returning({ n: column });
  return `${kind === "sale" ? "V" : "C"}-${String(row!.n).padStart(4, "0")}`;
}

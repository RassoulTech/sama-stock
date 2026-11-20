import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/db";

/**
 * Une écriture de l'abonnement Finch à la fois par commerce (double clic de l'administrateur, deux onglets, tâche de
 * 9 h relancée) : la seconde attend la fin de la première, puis lit ce qu'elle a écrit. À prendre en premier dans la
 * transaction ; le verrou tombe avec elle.
 */
export async function verrouFinch(tx: Tx, businessId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`finch:${businessId}`}))`);
}

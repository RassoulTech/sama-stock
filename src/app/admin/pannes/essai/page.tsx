import { requireSuperAdmin } from "@/server/context";

/** Lève volontairement une erreur : vérifier la page d'erreur et l'alerte de bout en bout. */
export default async function AdminErrorTestPage(): Promise<never> {
  await requireSuperAdmin();
  throw new Error("Panne d'essai demandée depuis l'administration");
}

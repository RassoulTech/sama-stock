import { authClient } from "@/lib/auth-client";
import { offlineDb } from "./db";

/**
 * Déconnexion qui protège les ventes faites sans internet : elles restent dans le téléphone et partiront à la
 * prochaine connexion. La copie de la caisse est effacée. Renvoie false si l'utilisateur annule.
 */
export async function signOutSafely(): Promise<boolean> {
  let waiting = 0;
  try {
    const snapshot = await offlineDb.getSnapshot();
    waiting = (await offlineDb.listOutbox()).filter((s) => s.status !== "sent" && (!snapshot || s.userId === snapshot.user.id)).length;
  } catch {
    // Pas de base locale (navigation privée) : rien à protéger
  }
  if (waiting > 0) {
    const many = waiting > 1;
    const ok = window.confirm(
      `${waiting} vente${many ? "s" : ""} ${many ? "ne sont" : "n'est"} pas encore envoyée${many ? "s" : ""}. ` +
        `${many ? "Elles resteront" : "Elle restera"} dans ce téléphone et ${many ? "partiront" : "partira"} à votre prochaine connexion.\n\n` +
        "Se déconnecter quand même ?",
    );
    if (!ok) return false;
  }
  await authClient.signOut();
  await offlineDb.clearSnapshot().catch(() => {});
  return true;
}

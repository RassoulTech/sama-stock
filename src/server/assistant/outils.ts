// Pas de "server-only" : les dépendances (base, catalogue) sont injectées, ce qui rend l'exécuteur testable.
import { draftForModel, type DraftResult } from "@/lib/domain/assistant/drafts";
import type { EcranResult } from "@/lib/domain/assistant/ecrans";
import type { Mission } from "@/lib/domain/assistant/mission";
import { isDraftTool, isReadTool, type DraftToolName, type ReadToolName } from "@/lib/domain/assistant/tools";

export interface OutilDeps {
  read: (name: ReadToolName, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  draft: (name: DraftToolName, args: Record<string, unknown>) => Promise<DraftResult> | DraftResult;
  ecran: (args: Record<string, unknown>) => Promise<EcranResult> | EcranResult;
}

/** Ce que l'IA reçoit en retour, et ce que le téléphone doit jouer à l'écran (ou rien). */
export interface ResultatOutil {
  reponse: Record<string, unknown>;
  mission: Mission | null;
}

const refus = (raison: string, candidats?: string[]): Record<string, unknown> => ({ ok: false, raison, ...(candidats ? { candidats } : {}) });

/**
 * Exécute un outil demandé par l'IA (lecture, brouillon, écran), après vérification des droits. N'écrit jamais rien :
 * un brouillon devient une mission que le téléphone remplit à l'écran, et seul le vrai bouton de l'écran enregistre.
 */
export async function executerOutil(name: string, args: Record<string, unknown>, autorises: ReadonlySet<string>, deps: OutilDeps): Promise<ResultatOutil> {
  if (!autorises.has(name)) return { reponse: { erreur: "Outil non autorisé pour cet utilisateur." }, mission: null };
  if (isReadTool(name)) return { reponse: await deps.read(name, args), mission: null };
  if (isDraftTool(name)) {
    const resultat = await deps.draft(name, args);
    if (!resultat.ok) return { reponse: refus(resultat.reason, resultat.candidates), mission: null };
    return { reponse: { ok: true, brouillon: draftForModel(resultat.draft) }, mission: { type: "tache", tache: resultat.draft } };
  }
  if (name === "montrer_ecran") {
    const resultat = await deps.ecran(args);
    if (!resultat.ok) return { reponse: refus(resultat.reason, resultat.candidates), mission: null };
    return { reponse: { ok: true, ecran: resultat.ecran.titre }, mission: { type: "ecran", ecran: resultat.ecran } };
  }
  return { reponse: { erreur: "Outil inconnu." }, mission: null };
}

// src/lib/domain/assistant/mission.ts
import { draftForModel, type Draft } from "./drafts";
import type { EcranMission } from "./ecrans";

/** Ce que le téléphone doit jouer : une tâche à remplir à l'écran, ou un écran à montrer. */
export type Mission = { type: "tache"; tache: Draft } | { type: "ecran"; ecran: EcranMission };
export type Confirmation = "oui" | "non";

/** Texte renvoyé au serveur pendant l'attente du « oui » : la tâche sans aucun identifiant. */
export function missionForModel(mission: Mission): string {
  return JSON.stringify(mission.type === "tache" ? draftForModel(mission.tache) : { ecran: mission.ecran.titre });
}

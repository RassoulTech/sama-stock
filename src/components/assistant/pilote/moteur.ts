// src/components/assistant/pilote/moteur.ts
import type { Mission } from "@/lib/domain/assistant/mission";
import type { ClePhrase } from "@/lib/domain/assistant/phrases";
import type { Etape, NomPilote, Pilotes, ResultatPilote } from "./types";

/** Ce que le joueur demande au téléphone (le vrai écran, ou des faux dans les tests). */
export interface Scene {
  /** Ouvre la page ; false si elle ne s'ouvre pas à temps. */
  ouvrir(url: string): Promise<boolean>;
  pilote<N extends NomPilote>(nom: N, delaiMs: number): Promise<Pilotes[N] | null>;
  /** Pose le doigt sur la cible ; false si elle n'apparaît pas (le geste se fait quand même). */
  pointer(cible: string, delaiMs: number): Promise<boolean>;
  pause(ms: number): Promise<void>;
  statut(texte: string): void;
  dire(cle: ClePhrase): void;
  demander(resume: string, signal: AbortSignal): Promise<ReponseAccord>;
}

export type ReponseAccord = { type: "oui" } | { type: "non" } | { type: "correction"; mission: Mission };

export type FinMission =
  | { etat: "enregistre"; message: string }
  | { etat: "refuse"; message: string }
  | { etat: "laisse" }
  | { etat: "montre" }
  | { etat: "corrige"; mission: Mission }
  | { etat: "arrete"; raison: "reprise" | "ecran" };

export const DELAIS = { pilote: 8_000, cible: 3_000, pas: 450 } as const;

function appeler(pilote: unknown, op: string, args: unknown[]): unknown {
  const fonction = (pilote as Record<string, unknown>)[op];
  if (typeof fonction !== "function") throw new Error(`Opération inconnue : ${op}`);
  return (fonction as (...a: unknown[]) => unknown)(...args);
}

/** Joue les étapes une à une. Rien n'est enregistré avant un « oui ». */
export async function jouer(etapes: readonly Etape[], scene: Scene, signal: AbortSignal): Promise<FinMission> {
  const reprise: FinMission = { etat: "arrete", raison: "reprise" };
  const ecran: FinMission = { etat: "arrete", raison: "ecran" };
  for (const etape of etapes) {
    if (signal.aborted) return reprise;
    switch (etape.type) {
      case "ouvrir":
        scene.statut(etape.texte);
        if (!(await scene.ouvrir(etape.url))) return ecran;
        break;
      case "attendre":
        if (!(await scene.pilote(etape.pilote, DELAIS.pilote))) return ecran;
        break;
      case "agir": {
        const pilote = await scene.pilote(etape.pilote, DELAIS.pilote);
        if (!pilote) return ecran;
        scene.statut(etape.texte);
        if (etape.cible) await scene.pointer(etape.cible, DELAIS.cible);
        if (signal.aborted) return reprise;
        appeler(pilote, etape.op, etape.args);
        await scene.pause(DELAIS.pas);
        break;
      }
      case "montrer":
        scene.statut(etape.texte);
        await scene.pointer(etape.cible, DELAIS.cible);
        break;
      case "confirmer": {
        await scene.pointer(etape.cible, DELAIS.cible);
        if (signal.aborted) return reprise;
        scene.dire("je-peux-enregistrer");
        const reponse = await scene.demander(etape.resume, signal);
        if (signal.aborted) return reprise;
        if (reponse.type === "non") {
          scene.dire("laisse");
          return { etat: "laisse" };
        }
        if (reponse.type === "correction") return { etat: "corrige", mission: reponse.mission };
        break;
      }
      case "enregistrer": {
        const pilote = await scene.pilote(etape.pilote, DELAIS.pilote);
        if (!pilote) return ecran;
        scene.statut("J'enregistre…");
        await scene.pointer(etape.cible, DELAIS.cible);
        let resultat: ResultatPilote;
        try {
          resultat = await (appeler(pilote, etape.op, etape.args) as Promise<ResultatPilote>);
        } catch {
          resultat = { ok: false, message: "Une erreur est survenue à l'enregistrement." };
        }
        scene.dire(resultat.ok ? "enregistre" : "souci");
        return resultat.ok ? { etat: "enregistre", message: resultat.message } : { etat: "refuse", message: resultat.message };
      }
    }
  }
  return { etat: "montre" };
}

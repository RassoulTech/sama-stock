// src/components/assistant/assistant-provider.tsx
"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { dansLaBulle } from "@/components/ui/garde-bulle";
import type { Mission } from "@/lib/domain/assistant/mission";
import { executerOutilServeur } from "./api";
import { creerConversation, type Conversation, type EtatConversation } from "./direct/conversation";
import type { AppelOutil } from "./direct/protocole";
import { jouer, type FinMission, type ReponseAccord } from "./pilote/moteur";
import { etapesPour } from "./pilote/recettes";
import { creerScene, type PositionDoigt } from "./pilote/scene-dom";

export type Phase = "repos" | "connexion" | "ecoute" | "parle" | "outil" | "pilote" | "confirmation";

export const STATUTS: Record<Phase, string> = {
  repos: "Touche le micro pour parler avec l'assistant.",
  connexion: "Je me prépare…",
  ecoute: "Je t'écoute…",
  parle: "Je te réponds…",
  outil: "Je regarde…",
  pilote: "Je fais la tâche à l'écran…",
  confirmation: "Je l'enregistre ?",
};

interface AssistantValue {
  /** Une conversation est en cours. */
  actif: boolean;
  phase: Phase;
  notice: string | null;
  statut: string | null;
  resume: string | null;
  doigt: PositionDoigt | null;
  touche: number;
  demarrer: () => void;
  terminer: () => void;
  couperParole: () => void;
  accord: (oui: boolean) => void;
  arreterTache: () => void;
  fermerStatut: () => void;
}

const AssistantContext = createContext<AssistantValue | null>(null);

export function useAssistant(): AssistantValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant doit être utilisé dans AssistantProvider.");
  return value;
}

/** Après une tâche, son résultat reste dans la bulle quelques secondes. */
const STATUT_MS = 5_000;

const PHASE_DE: Record<EtatConversation, Phase> = { connexion: "connexion", ecoute: "ecoute", parle: "parle", outil: "outil" };

/**
 * Dialogue vocal pour toute l'application : on parle, l'assistant répond à voix haute, fait les tâches à l'écran
 * (mode pilote) et relance la conversation. Il survit aux changements de page.
 */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [actif, setActif] = useState(false);
  const [phase, setPhase] = useState<Phase>("repos");
  const [notice, setNotice] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const [resume, setResume] = useState<string | null>(null);
  const [doigt, setDoigt] = useState<PositionDoigt | null>(null);
  const [touche, setTouche] = useState(0);

  const contexteAudio = useRef<AudioContext | null>(null);
  const conversation = useRef<Conversation | null>(null);
  const controle = useRef<AbortController | null>(null);
  const attente = useRef<{ mission: Mission; resoudre: (reponse: ReponseAccord) => void } | null>(null);
  const missionCourante = useRef<Mission | null>(null);
  const piloteEnCours = useRef(false);
  /** Appel de brouillon qui attend que le formulaire soit rempli pour recevoir sa réponse. */
  const appelBrouillon = useRef<{ id: string; name: string; reponse: Record<string, unknown> } | null>(null);
  /** Appel « confirmer » qui attend le résultat du bouton final. */
  const appelConfirmation = useRef<{ id: string; name: string } | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Départ de l'application : conversation et tâche arrêtées.
  useEffect(() => {
    const conv = conversation;
    const c = controle;
    return () => {
      c.current?.abort();
      conv.current?.terminer();
    };
  }, []);

  // Toucher la page pendant une tâche = reprendre la main (la bulle ne compte pas).
  useEffect(() => {
    if (phase !== "pilote" && phase !== "confirmation") return;
    const surToucher = (event: PointerEvent) => {
      if (!dansLaBulle({ target: event.target })) controle.current?.abort();
    };
    document.addEventListener("pointerdown", surToucher, true);
    return () => document.removeEventListener("pointerdown", surToucher, true);
  }, [phase]);

  function montrerStatut(texte: string | null) {
    if (minuterie.current) clearTimeout(minuterie.current);
    setStatut(texte);
    if (texte) minuterie.current = setTimeout(() => setStatut(null), STATUT_MS);
  }

  const scene = useMemo(
    () =>
      creerScene({
        router,
        deplacerDoigt: setDoigt,
        toucher: () => setTouche((n) => n + 1),
        statut: () => {},
        // L'assistant parle lui-même : pas de phrase enregistrée à jouer
        dire: () => {},
        demander: (texte, signal) =>
          new Promise<ReponseAccord>((resolve) => {
            const finir = (reponse: ReponseAccord) => {
              if (attente.current?.resoudre !== finir) return;
              attente.current = null;
              setResume(null);
              setPhase("pilote");
              resolve(reponse);
            };
            attente.current = { mission: missionCourante.current!, resoudre: finir };
            setResume(texte);
            setPhase("confirmation");
            // Le formulaire est prêt : l'assistant reçoit enfin la réponse de son brouillon et demande l'accord
            const appel = appelBrouillon.current;
            appelBrouillon.current = null;
            if (appel) {
              conversation.current?.repondreOutil(appel.id, appel.name, {
                ...appel.reponse,
                message: "Le formulaire est rempli à l'écran. Demande maintenant au commerçant s'il peut enregistrer.",
              });
            }
            signal.addEventListener("abort", () => finir({ type: "non" }), { once: true });
          }),
      }),
    [router],
  );

  /** Annonce le résultat d'une tâche à l'assistant, qui le dira à voix haute. */
  function rendreResultat(fin: FinMission) {
    let message: string | null = null;
    let ok = true;
    switch (fin.etat) {
      case "enregistre":
        message = fin.message;
        montrerStatut(fin.message);
        break;
      case "refuse":
        message = fin.message;
        ok = false;
        montrerStatut(fin.message);
        break;
      case "laisse":
        message = "D'accord, l'écran reste rempli, rien n'est enregistré.";
        break;
      case "arrete":
        ok = false;
        message =
          fin.raison === "reprise"
            ? "Le commerçant a repris la main à l'écran ; rien n'est enregistré."
            : "L'écran n'a pas répondu ; rien n'est enregistré.";
        montrerStatut(fin.raison === "reprise" ? "Tu as repris la main." : "L'écran ne répond pas : rien n'est enregistré.");
        break;
      case "montre":
      case "corrige":
        return;
    }
    const confirmation = appelConfirmation.current;
    const brouillon = appelBrouillon.current;
    appelConfirmation.current = null;
    appelBrouillon.current = null;
    if (confirmation) conversation.current?.repondreOutil(confirmation.id, confirmation.name, { ok, message });
    else if (brouillon) conversation.current?.repondreOutil(brouillon.id, brouillon.name, { ok: false, raison: message });
    else conversation.current?.noter(`(${message} Dis-le au commerçant en une phrase et demande s'il veut autre chose.)`);
  }

  async function lancer(mission: Mission): Promise<void> {
    piloteEnCours.current = true;
    setPhase("pilote");
    missionCourante.current = mission;
    const c = new AbortController();
    controle.current = c;
    let fin: FinMission;
    try {
      fin = await jouer(etapesPour(mission), scene, c.signal);
    } catch {
      fin = { etat: "arrete", raison: "ecran" };
    }
    controle.current = null;
    setDoigt(null);
    if (fin.etat === "corrige") return lancer(fin.mission);
    missionCourante.current = null;
    piloteEnCours.current = false;
    rendreResultat(fin);
    setPhase(conversation.current ? "ecoute" : "repos");
  }

  async function surOutils(appels: AppelOutil[]) {
    for (const appel of appels) {
      const conv = conversation.current;
      if (appel.name === "confirmer") {
        if (attente.current) {
          appelConfirmation.current = { id: appel.id, name: appel.name };
          attente.current.resoudre({ type: appel.args.reponse === "oui" ? "oui" : "non" });
        } else {
          conv?.repondreOutil(appel.id, appel.name, { ok: false, raison: "Aucune tâche n'attend d'accord à l'écran." });
        }
        continue;
      }
      const resultat = await executerOutilServeur(appel.name, appel.args);
      if (!resultat.ok) {
        conv?.repondreOutil(appel.id, appel.name, { ok: false, raison: resultat.error });
        continue;
      }
      const { reponse, mission } = resultat;
      if (mission?.type === "tache") {
        if (attente.current) {
          // Correction dite à voix haute : la tâche corrigée est rejouée sur l'écran déjà ouvert
          appelBrouillon.current = { id: appel.id, name: appel.name, reponse };
          attente.current.resoudre({ type: "correction", mission });
        } else if (piloteEnCours.current) {
          conv?.repondreOutil(appel.id, appel.name, { ok: false, raison: "Une tâche est déjà en train de se remplir à l'écran : termine-la d'abord." });
        } else {
          appelBrouillon.current = { id: appel.id, name: appel.name, reponse };
          void lancer(mission);
        }
        continue;
      }
      conv?.repondreOutil(appel.id, appel.name, reponse);
      if (mission?.type === "ecran" && !piloteEnCours.current) void lancer(mission);
    }
  }

  function surOutilsAnnules(ids: string[]) {
    // Le commerçant a parlé pendant que l'écran se remplissait : la tâche en cours est abandonnée
    if (appelBrouillon.current && ids.includes(appelBrouillon.current.id)) {
      appelBrouillon.current = null;
      controle.current?.abort();
    }
    if (appelConfirmation.current && ids.includes(appelConfirmation.current.id)) appelConfirmation.current = null;
  }

  function demarrer() {
    if (conversation.current) return;
    // Le son est débloqué ici, dans le toucher lui-même : sinon l'iPhone (et d'autres) refusent la voix plus tard.
    const contexte = contexteAudio.current ?? new AudioContext();
    contexteAudio.current = contexte;
    void contexte.resume();
    const silence = contexte.createBufferSource();
    silence.buffer = contexte.createBuffer(1, 1, 22_050);
    silence.connect(contexte.destination);
    silence.start();
    const sessionAudio = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (sessionAudio) sessionAudio.type = "play-and-record";

    setActif(true);
    setNotice(null);
    setPhase("connexion");
    conversation.current = creerConversation({
      contexte,
      surEtat: (etat) => {
        if (!piloteEnCours.current) setPhase(PHASE_DE[etat]);
      },
      surOutils: (appels) => void surOutils(appels),
      surOutilsAnnules,
      surFin: (raison) => {
        conversation.current = null;
        controle.current?.abort();
        appelBrouillon.current = null;
        appelConfirmation.current = null;
        setActif(false);
        setPhase("repos");
        if (raison) setNotice(raison);
      },
    });
  }

  const value: AssistantValue = {
    actif,
    phase,
    notice,
    statut,
    resume,
    doigt,
    touche,
    demarrer,
    terminer: () => conversation.current?.terminer(),
    couperParole: () => conversation.current?.couperParole(),
    accord: (oui) => attente.current?.resoudre({ type: oui ? "oui" : "non" }),
    arreterTache: () => controle.current?.abort(),
    fermerStatut: () => {
      montrerStatut(null);
      setNotice(null);
    },
  };

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

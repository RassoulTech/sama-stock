// src/components/assistant/assistant-provider.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { dansLaBulle } from "@/components/ui/garde-bulle";
import { texteCredits, type CreditsAffiches, type FicheAssistant } from "@/lib/domain/assistant/abonnement";
import type { Mission } from "@/lib/domain/assistant/mission";
import { choisirAffichage, type Affichage } from "./affichage";
import { executerOutilServeur } from "./api";
import { creerConversation, type Conversation, type EtatConversation } from "./direct/conversation";
import type { AppelOutil } from "./direct/protocole";
import { choisirBouton, estRisque, libellesUniques } from "./pilote/boutons";
import { jouer, type FinMission, type ReponseAccord } from "./pilote/moteur";
import { etapesPour } from "./pilote/recettes";
import { attendrePilote, lirePilote } from "./pilote/registre";
import {
  allerASection,
  appuyer,
  champsSaisissables,
  creerScene,
  defilerPage,
  elementsCliquables,
  fenetreEstOuverte,
  genreElement,
  lireEcran,
  pointerElement,
  remplirChamp,
  sectionsPage,
  texteDe,
  texteVisible,
  trouverCible,
  trouverSection,
  type PositionDoigt,
} from "./pilote/scene-dom";

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
  /** Plein écran pour parler, bulle en bas pendant les tâches. */
  affichage: Affichage;
  phase: Phase;
  notice: string | null;
  statut: string | null;
  resume: string | null;
  /** La question posée pendant l'accord (« Je l'enregistre ? », « J'appuie dessus ? »). */
  question: string;
  doigt: PositionDoigt | null;
  touche: number;
  /** Bouton que le commerçant doit toucher lui-même (le téléphone exige un vrai toucher pour envoyer un fichier). */
  geste: string | null;
  demarrer: () => void;
  terminer: () => void;
  couperParole: () => void;
  /** Niveau du son de celui qui parle (0 à 1), lu à chaque image pour faire battre le rond. */
  niveau: () => number;
  /** Rond de la bulle touché : retour au plein écran (sauf pendant une tâche). */
  agrandir: () => void;
  reduire: () => void;
  accord: (oui: boolean) => void;
  arreterTache: () => void;
  faireGeste: () => void;
  /** Fiche montrée quand Finch n'est pas payé ou n'a plus de crédits (activer, renouveler, recharger). */
  fiche: FicheAssistant | null;
  fermerFiche: () => void;
  /** Conversations restantes de la conversation en cours (null : démonstration ou pas de conversation). */
  credits: CreditsAffiches | null;
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
/** Le temps qu'un appui fasse son effet (fenêtre qui s'ouvre, page qui change) avant de le raconter. */
const APRES_APPUI_MS = 800;
/** Un « oui » qui ouvre une fenêtre de confirmation vaut aussi pour son bouton final, pendant ce temps. */
const ACCORD_FENETRE_MS = 120_000;
/** Après un appui dans une fenêtre (bouton final), le temps laissé à l'enregistrement pour la refermer. */
const FERMETURE_FENETRE_MS = 6_000;
/** Le doigt reste quelques instants sur le titre d'une section avant de s'effacer. */
const DOIGT_SECTION_MS = 1_800;
/** Le temps laissé à une page qui vient de s'ouvrir pour afficher ses sections. */
const ATTENTE_SECTIONS_MS = 4_000;

const PHASE_DE: Record<EtatConversation, Phase> = { connexion: "connexion", ecoute: "ecoute", parle: "parle", outil: "outil" };

const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const pageActuelle = () => `${window.location.pathname}${window.location.search}`;

/**
 * Dialogue vocal pour toute l'application : on parle, l'assistant répond à voix haute, se sert de l'écran comme une
 * personne (ouvrir une page, lire, appuyer sur un bouton), fait les tâches à l'écran (mode pilote) et relance la
 * conversation. Il survit aux changements de page.
 */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const chemin = usePathname();
  const [actif, setActif] = useState(false);
  const [phase, setPhase] = useState<Phase>("repos");
  const [notice, setNotice] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const [resume, setResume] = useState<string | null>(null);
  const [fiche, setFiche] = useState<FicheAssistant | null>(null);
  const [credits, setCredits] = useState<CreditsAffiches | null>(null);
  const [question, setQuestion] = useState(STATUTS.confirmation);
  const [doigt, setDoigt] = useState<PositionDoigt | null>(null);
  const [touche, setTouche] = useState(0);
  const [geste, setGeste] = useState<{ texte: string; chemin: string } | null>(null);
  const [plein, setPlein] = useState(true);

  const contexteAudio = useRef<AudioContext | null>(null);
  const conversation = useRef<Conversation | null>(null);
  const controle = useRef<AbortController | null>(null);
  const attente = useRef<{ resoudre: (reponse: ReponseAccord) => void } | null>(null);
  const piloteEnCours = useRef(false);
  /** Appel de brouillon qui attend que le formulaire soit rempli pour recevoir sa réponse. */
  const appelBrouillon = useRef<{ id: string; name: string; reponse: Record<string, unknown> } | null>(null);
  /** Appel « confirmer » qui attend le résultat du bouton final. */
  const appelConfirmation = useRef<{ id: string; name: string } | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Jusqu'à quand un « oui » donné vaut pour le bouton de la fenêtre de confirmation qu'il a ouverte. */
  const accordFenetre = useRef(0);
  const minuterieDoigt = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Départ de l'application : conversation et tâche arrêtées.
  useEffect(() => {
    const conv = conversation;
    const c = controle;
    return () => {
      c.current?.abort();
      conv.current?.terminer();
    };
  }, []);

  // Toucher la page pendant une tâche = reprendre la main (la bulle ne compte pas, ni les appuis de l'assistant).
  useEffect(() => {
    if (phase !== "pilote" && phase !== "confirmation") return;
    const surToucher = (event: PointerEvent) => {
      if (event.isTrusted && !dansLaBulle({ target: event.target })) controle.current?.abort();
    };
    document.addEventListener("pointerdown", surToucher, true);
    return () => document.removeEventListener("pointerdown", surToucher, true);
  }, [phase]);

  function montrerStatut(texte: string | null) {
    if (minuterie.current) clearTimeout(minuterie.current);
    setStatut(texte);
    if (texte) minuterie.current = setTimeout(() => setStatut(null), STATUT_MS);
  }

  const gestesDoigt = { deplacerDoigt: setDoigt, toucher: () => setTouche((n) => n + 1) };

  /** Le résumé et Oui / Non dans la bulle, jusqu'à la réponse (dite, touchée, ou la main reprise sur l'écran). */
  function attendreAccord(texte: string, signal: AbortSignal, demande = STATUTS.confirmation): Promise<ReponseAccord> {
    return new Promise<ReponseAccord>((resolve) => {
      const finir = (reponse: ReponseAccord) => {
        if (attente.current?.resoudre !== finir) return;
        attente.current = null;
        setResume(null);
        setPhase("pilote");
        resolve(reponse);
      };
      attente.current = { resoudre: finir };
      setResume(texte);
      setQuestion(demande);
      setPhase("confirmation");
      signal.addEventListener("abort", () => finir({ type: "non" }), { once: true });
    });
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
        demander: (texte, signal) => {
          const reponse = attendreAccord(texte, signal);
          // Le formulaire est prêt : l'assistant reçoit enfin la réponse de son brouillon et demande l'accord
          const appel = appelBrouillon.current;
          appelBrouillon.current = null;
          if (appel) {
            conversation.current?.repondreOutil(appel.id, appel.name, {
              ...appel.reponse,
              message: "Le formulaire est rempli à l'écran. Demande maintenant au commerçant s'il peut enregistrer.",
            });
          }
          return reponse;
        },
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

  /** Joue une mission à l'écran (doigt, champs remplis, accord) et rend sa fin. */
  async function jouerMission(mission: Mission): Promise<FinMission> {
    piloteEnCours.current = true;
    setPlein(false);
    setPhase("pilote");
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
    if (fin.etat === "corrige") return jouerMission(fin.mission);
    piloteEnCours.current = false;
    setPhase(conversation.current ? "ecoute" : "repos");
    return fin;
  }

  async function lancer(mission: Mission): Promise<void> {
    rendreResultat(await jouerMission(mission));
  }

  /** Lit ce qui est affiché (ou une section entière), avec les boutons qu'on peut toucher. */
  function lire(section?: string): Record<string, unknown> {
    const ecran = lireEcran(section);
    const introuvable = section && !ecran.section ? { section_introuvable: `Aucune section « ${section} » ici.` } : {};
    return { ok: true, ...ecran, ...introuvable, boutons: libellesUniques(elementsCliquables()) };
  }

  /** Doigt posé un instant sur un titre de section, puis effacé. */
  function doigtFurtif(position: PositionDoigt | null) {
    if (minuterieDoigt.current) clearTimeout(minuterieDoigt.current);
    setDoigt(position);
    if (position) minuterieDoigt.current = setTimeout(() => setDoigt(null), DOIGT_SECTION_MS);
  }

  /** Descend jusqu'à la section (en attendant qu'elle s'affiche) et rend son texte, ou les sections présentes. */
  async function montrerSection(nom: string, attenteMs = 0): Promise<Record<string, unknown>> {
    const fin = Date.now() + attenteMs;
    let section = trouverSection(nom);
    while (!section && Date.now() < fin) {
      await attendre(250);
      section = trouverSection(nom);
    }
    if (!section) return { section_introuvable: `Aucune section « ${nom} » sur cette page.`, sections: sectionsPage().map((s) => s.titre) };
    await allerASection(section, doigtFurtif);
    return { section: section.titre, texte: texteDe(section.element) };
  }

  /** Fait défiler la page (vers une section, ou d'un écran) et dit ce qui est maintenant affiché. */
  async function defiler(appel: AppelOutil): Promise<void> {
    const repondre = (reponse: Record<string, unknown>) => conversation.current?.repondreOutil(appel.id, appel.name, reponse);
    if (piloteEnCours.current) {
      repondre({ ok: false, raison: "Une tâche est en cours à l'écran : termine-la d'abord." });
      return;
    }
    const nom = typeof appel.args.section === "string" ? appel.args.section.trim() : "";
    if (nom) {
      const resultat = await montrerSection(nom);
      repondre({ ok: !("section_introuvable" in resultat), ...resultat });
      return;
    }
    const sens = ["bas", "haut", "debut", "fin"].includes(String(appel.args.sens)) ? (appel.args.sens as "bas" | "haut" | "debut" | "fin") : "bas";
    await defilerPage(sens);
    const bas = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
    repondre({ ok: true, texte: texteVisible(), sections: sectionsPage().map((s) => s.titre), ...(bas ? { fin_de_page: true } : {}) });
  }

  /** Tape une valeur dans un champ visible ; si le produit n'est pas affiché, le cherche d'abord dans la recherche. */
  async function saisir(appel: AppelOutil): Promise<void> {
    const repondre = (reponse: Record<string, unknown>) => conversation.current?.repondreOutil(appel.id, appel.name, reponse);
    if (piloteEnCours.current) {
      repondre({ ok: false, raison: "Une tâche est en cours à l'écran : termine-la d'abord." });
      return;
    }
    const demande = typeof appel.args.champ === "string" ? appel.args.champ : "";
    const valeur = appel.args.valeur === undefined || appel.args.valeur === null ? "" : String(appel.args.valeur);
    let choisi = choisirBouton(demande, champsSaisissables());
    // « Quantité comptée pour Riz » : un produit caché plus bas dans la liste se retrouve par la recherche de la page
    const quoi = demande.replace(/^.*\bpour\s+/i, "").trim();
    if ((!choisi || choisi.element.matches('[type="search"], [placeholder^="Recherch"]')) && quoi && quoi !== demande) {
      const recherche = champsSaisissables().find((c) => /recherch/i.test(c.libelle));
      if (recherche) {
        remplirChamp(recherche.element, quoi);
        await attendre(500);
        choisi = choisirBouton(demande, champsSaisissables().filter((c) => c.element !== recherche.element));
      }
    }
    if (!choisi) {
      repondre({ ok: false, raison: `Aucun champ « ${demande} » à l'écran.`, champs_visibles: libellesUniques(champsSaisissables(), 25) });
      return;
    }
    piloteEnCours.current = true;
    setPlein(false);
    setPhase("pilote");
    try {
      await pointerElement(choisi.element, gestesDoigt);
      remplirChamp(choisi.element, valeur);
      await attendre(300);
      repondre({ ok: true, champ: choisi.libelle, valeur, message: "C'est tapé à l'écran ; rien n'est enregistré tant que le bouton final n'est pas touché." });
    } finally {
      setDoigt(null);
      piloteEnCours.current = false;
      setPhase(conversation.current ? "ecoute" : "repos");
    }
  }

  /** Appuie sur un bouton visible ; s'il enregistre, envoie ou supprime, le commerçant dit oui d'abord. */
  async function cliquer(appel: AppelOutil): Promise<void> {
    const repondre = (reponse: Record<string, unknown>) => conversation.current?.repondreOutil(appel.id, appel.name, reponse);
    if (piloteEnCours.current) {
      repondre({ ok: false, raison: "Une tâche est en cours à l'écran : termine-la d'abord." });
      return;
    }
    const demande = typeof appel.args.libelle === "string" ? appel.args.libelle : "";
    const boutons = elementsCliquables();
    const choisi = choisirBouton(demande, boutons);
    if (!choisi) {
      repondre({ ok: false, raison: `Aucun bouton « ${demande} » à l'écran.`, boutons_visibles: libellesUniques(boutons) });
      return;
    }
    const nom = choisi.libelle;
    piloteEnCours.current = true;
    setPlein(false);
    setPhase("pilote");
    let accordDemande = false;
    let appuie = true;
    let suite: Mission | null = null;
    try {
      await pointerElement(choisi.element, gestesDoigt);
      const dansFenetre = choisi.element.closest('[role="dialog"], [role="alertdialog"]') !== null;
      const dejaAccorde = dansFenetre && accordFenetre.current > Date.now();
      accordFenetre.current = 0;
      if (!dejaAccorde && estRisque(nom, genreElement(choisi.element))) {
        accordDemande = true;
        repondre({
          ok: false,
          accord_requis: true,
          message: `Le doigt est sur « ${nom} ». Demande au commerçant en une phrase s'il veut vraiment que tu appuies dessus (sans parler d'enregistrer) ; s'il dit oui, appelle confirmer avec oui.`,
        });
        const c = new AbortController();
        controle.current = c;
        const accord = await attendreAccord(`Appuyer sur « ${nom} »`, c.signal, "J'appuie dessus ?");
        controle.current = null;
        if (accord.type !== "oui") {
          appuie = false;
          if (accord.type === "correction") suite = accord.mission;
          else rendreApresAccord({ ok: false, message: `D'accord, je n'appuie pas sur « ${nom} ».` });
        }
      }
      if (appuie) {
        const avant = pageActuelle();
        appuyer(choisi.element);
        await attendre(APRES_APPUI_MS);
        // Bouton d'une fenêtre : l'enregistrement la referme, on attend la fin avant de raconter
        const finAttente = Date.now() + FERMETURE_FENETRE_MS;
        while (dansFenetre && choisi.element.isConnected && fenetreEstOuverte() && Date.now() < finAttente) await attendre(250);
        const apres = pageActuelle();
        let message = `J'ai appuyé sur « ${nom} ».${apres !== avant ? " Une nouvelle page est ouverte." : ""} Lis l'écran si tu dois savoir ce qui a changé.`;
        let fenetre: Record<string, unknown> = {};
        if (fenetreEstOuverte() && !dansFenetre) {
          // Une fenêtre de confirmation s'ouvre : rien n'est encore fait, le bouton final est dedans
          const vue = lireEcran();
          const boutons = libellesUniques(elementsCliquables());
          fenetre = { fenetre: vue.fenetre, texte_fenetre: vue.texte.slice(0, 1_200), boutons_fenetre: boutons };
          if (accordDemande) {
            // Le « oui » déjà donné vaut pour le bouton final de cette fenêtre
            accordFenetre.current = Date.now() + ACCORD_FENETRE_MS;
            message = `J'ai appuyé sur « ${nom} » : une fenêtre de confirmation est ouverte, RIEN N'EST ENCORE ENREGISTRÉ. Dis au commerçant l'essentiel de la fenêtre en une phrase, puis appelle cliquer sur son bouton final (son accord vaut déjà pour ce bouton).`;
          } else {
            message = `J'ai appuyé sur « ${nom} » : une fenêtre est ouverte (voir son texte et ses boutons).`;
          }
        } else if (dansFenetre && fenetreEstOuverte()) {
          // La fenêtre est restée ouverte : souvent un message d'erreur, à lire au commerçant
          fenetre = { texte_fenetre: lireEcran().texte.slice(0, 1_000) };
          message = `J'ai appuyé sur « ${nom} », mais la fenêtre est toujours ouverte : lis texte_fenetre (une erreur ou une question) avant de dire quoi que ce soit.`;
        } else if (accordDemande || dejaAccorde) {
          // Bouton final : ce que montre l'écran après l'appui dit si c'est vraiment fait
          fenetre = { ecran_apres: lireEcran().texte.slice(0, 1_000) };
          message = `J'ai appuyé sur « ${nom} ».${apres !== avant ? " Une nouvelle page est ouverte." : ""} Vérifie dans ecran_apres que c'est bien fait avant de le dire au commerçant.`;
        }
        const reponse = { ok: true, message, page: apres, ...fenetre };
        if (accordDemande) rendreApresAccord(reponse);
        else repondre(reponse);
      }
    } finally {
      setDoigt(null);
      piloteEnCours.current = false;
      setPhase(conversation.current ? "ecoute" : "repos");
    }
    // Un brouillon dit pendant l'accord : c'est cette tâche que le commerçant veut maintenant
    if (suite) void lancer(suite);
  }

  /** Le résultat d'un appui qui attendait l'accord : à l'appel « confirmer », sinon (Oui / Non touché) en note. */
  function rendreApresAccord(reponse: { ok: boolean; message: string; page?: string }) {
    const confirmation = appelConfirmation.current;
    appelConfirmation.current = null;
    if (confirmation) conversation.current?.repondreOutil(confirmation.id, confirmation.name, reponse);
    else conversation.current?.noter(`(${reponse.message} Dis-le au commerçant en une phrase.)`);
  }

  /** Prépare l'envoi WhatsApp du document ouvert : le commerçant touche le bouton vert de la bulle. */
  async function envoyerWhatsApp(appel: AppelOutil): Promise<void> {
    const repondre = (reponse: Record<string, unknown>) => conversation.current?.repondreOutil(appel.id, appel.name, reponse);
    if (!(await attendrePilote("document", 1_500))) {
      repondre({
        ok: false,
        raison:
          "Aucun reçu, facture ou devis n'est ouvert à l'écran. Ouvre d'abord le document (par exemple montrer_ecran derniere_vente), puis rappelle envoyer_whatsapp.",
      });
      return;
    }
    setPlein(false);
    const bouton = trouverCible("document.envoyer");
    if (bouton) await pointerElement(bouton, gestesDoigt);
    setDoigt(null);
    setGeste({ texte: "Envoyer sur WhatsApp", chemin: window.location.pathname });
    repondre({
      ok: true,
      attend_un_toucher: true,
      message:
        "Le bouton vert « Envoyer sur WhatsApp » est affiché dans la bulle. Dis au commerçant de le toucher : le téléphone demande toujours un toucher pour envoyer un fichier.",
    });
  }

  /** Le commerçant touche le bouton vert : l'envoi part dans son toucher, comme le navigateur l'exige. */
  function faireGeste() {
    setGeste(null);
    const pilote = lirePilote("document");
    if (!pilote) {
      montrerStatut("Ouvre d'abord le reçu à envoyer.");
      return;
    }
    pilote.envoyer().then(
      (resultat) => {
        montrerStatut(resultat.message);
        conversation.current?.noter(`(${resultat.message} Dis-le au commerçant en une phrase.)`);
      },
      () => montrerStatut("L'envoi n'a pas marché : touche le bouton WhatsApp de la page."),
    );
  }

  async function surOutils(appels: AppelOutil[]) {
    for (const appel of appels) {
      const conv = conversation.current;
      switch (appel.name) {
        case "confirmer":
          if (attente.current) {
            appelConfirmation.current = { id: appel.id, name: appel.name };
            attente.current.resoudre({ type: appel.args.reponse === "oui" ? "oui" : "non" });
          } else {
            conv?.repondreOutil(appel.id, appel.name, { ok: false, raison: "Aucune tâche n'attend d'accord à l'écran." });
          }
          continue;
        case "lire_ecran":
          conv?.repondreOutil(appel.id, appel.name, lire(typeof appel.args.section === "string" && appel.args.section.trim() ? appel.args.section : undefined));
          continue;
        case "defiler":
          await defiler(appel);
          continue;
        case "saisir":
          await saisir(appel);
          continue;
        case "cliquer":
          await cliquer(appel);
          continue;
        case "envoyer_whatsapp":
          await envoyerWhatsApp(appel);
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
      if (mission?.type === "ecran") {
        if (piloteEnCours.current) {
          conv?.repondreOutil(appel.id, appel.name, { ok: false, raison: "Une tâche attend à l'écran : termine-la d'abord." });
          continue;
        }
        // La réponse part une fois la page affichée (et la section atteinte) : l'assistant dit alors ce qu'on y voit
        const fin = await jouerMission(mission);
        if (fin.etat !== "montre") {
          conv?.repondreOutil(appel.id, appel.name, {
            ok: false,
            raison: fin.etat === "arrete" && fin.raison === "reprise" ? "Le commerçant a repris la main." : "La page ne s'est pas ouverte.",
          });
          continue;
        }
        // Sans section, la page vient de s'ouvrir en haut : on lit son début (titre, filtres, total, premières lignes)
        const vue = mission.ecran.section
          ? await montrerSection(mission.ecran.section, ATTENTE_SECTIONS_MS)
          : { texte: lireEcran().texte.slice(0, 2_500), sections: sectionsPage().map((s) => s.titre) };
        conv?.repondreOutil(appel.id, appel.name, { ...reponse, page_ouverte: true, ...vue });
        continue;
      }
      conv?.repondreOutil(appel.id, appel.name, reponse);
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
    setPlein(true);
    setNotice(null);
    setFiche(null);
    setCredits(null);
    setPhase("connexion");
    conversation.current = creerConversation({
      contexte,
      surEtat: (etat) => {
        if (!piloteEnCours.current) setPhase(PHASE_DE[etat]);
      },
      surOutils: (appels) => void surOutils(appels),
      surOutilsAnnules,
      surFiche: setFiche,
      surCredits: (c) => setCredits(c ? texteCredits(c.restants, c.essai) : null),
      surFin: (raison) => {
        conversation.current = null;
        controle.current?.abort();
        appelBrouillon.current = null;
        appelConfirmation.current = null;
        setGeste(null);
        setCredits(null);
        setActif(false);
        setPhase("repos");
        if (raison) setNotice(raison);
      },
    });
  }

  // Le bouton vert ne vaut que sur la page du document qu'il envoie
  const gesteVisible = geste && geste.chemin === chemin ? geste.texte : null;

  const value: AssistantValue = {
    actif,
    affichage: choisirAffichage({ actif, plein, phase, geste: gesteVisible !== null, message: statut !== null || notice !== null }),
    phase,
    notice,
    statut,
    resume,
    question,
    doigt,
    touche,
    geste: gesteVisible,
    demarrer,
    terminer: () => conversation.current?.terminer(),
    couperParole: () => conversation.current?.couperParole(),
    niveau: () => conversation.current?.niveau() ?? 0,
    agrandir: () => {
      if (!piloteEnCours.current) setPlein(true);
    },
    reduire: () => setPlein(false),
    accord: (oui) => attente.current?.resoudre({ type: oui ? "oui" : "non" }),
    arreterTache: () => controle.current?.abort(),
    faireGeste,
    fiche,
    fermerFiche: () => setFiche(null),
    credits,
    fermerStatut: () => {
      montrerStatut(null);
      setNotice(null);
    },
  };

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

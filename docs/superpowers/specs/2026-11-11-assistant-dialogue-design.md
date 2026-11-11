# Assistant en dialogue vocal — conception

Date : 2026-11-11. Remplace l'interface « question → réponse écrite » de `2026-11-11-assistant-pilote-design.md` ;
le mode pilote (recettes, joueur, pilotes d'écran, cibles) est gardé tel quel.

## Demande du commerçant

« On doit lui parler comme à une personne : je parle, il me répond à voix haute, il fait les instructions, puis il me
repose des questions, on discute. Pas de réponses écrites. » Constat le même jour : l'assistant ne parlait pas
(il affichait du texte).

## Cause du silence

Le serveur fabriquait bien la voix (journaux Vercel), et le navigateur du commerçant sait parler (essai direct).
Le son démarrait plusieurs secondes après le toucher, une fois la réponse reçue : beaucoup de téléphones (iPhone en
tête) refusent un son qui ne part pas d'un toucher. Le nouveau mode crée et débloque son lecteur de son au moment
même où l'on touche le micro, puis joue tout par lui.

## Choix mesurés (2026-11-11, clé gratuite)

| Voie | Première voix | Wolof |
|---|---|---|
| Anta (voix publique, sans carte graphique) | 17 s | bon, mais trop lent pour un dialogue |
| Gemini 3.1 flash TTS (texte → voix) | 4 à 5 s | compréhensible (retranscrit presque mot pour mot) |
| **Gemini 3.1 flash Live (dialogue en direct)** | **0,6 s** | compréhensible, relance tout seul (« Ndax bëgg nga xam… ? ») |

Retenu : **Gemini Live**. Le téléphone parle directement avec Google en continu (micro → Google, voix ← Google). Google
détecte la fin de parole, répond à voix haute et appelle les outils de l'assistant.

## Fonctionnement

1. Toucher le micro : le lecteur de son est créé et débloqué dans ce toucher ; le téléphone demande une **clé
   temporaire** à `POST /api/assistant/session` (droits, assistant activé, quota du jour : une conversation = une
   demande). La clé (usage unique, 15 min) fige le modèle, la voix, les consignes, le catalogue et les outils
   autorisés pour ce rôle : le téléphone ne peut rien changer, et la vraie clé Google ne quitte pas le serveur.
2. Le téléphone ouvre la session Live avec cette clé, envoie le micro (PCM 16 kHz) et joue la voix reçue (PCM 24 kHz).
   Pendant que l'assistant parle, le micro n'est pas envoyé (sinon il s'entendrait lui-même) ; toucher la bulle le coupe.
3. Quand Google appelle un outil, le téléphone le fait exécuter par `POST /api/assistant/outil`, qui revérifie les
   droits et réutilise les lectures, les brouillons et les écrans existants (`executerOutil`, partagé avec l'ancienne
   route). Le serveur n'écrit toujours rien.
   - Lecture : la réponse repart tout de suite ; l'assistant dit les chiffres lui-même.
   - `montrer_ecran` : la réponse repart tout de suite et l'écran s'ouvre en même temps (doigt sur le chiffre).
   - Brouillon : le mode pilote remplit le vrai écran ; la réponse ne repart qu'une fois le formulaire prêt. L'assistant,
     resté silencieux pendant le remplissage, demande alors « Ndax ma bind ko ? ».
   - `confirmer` (« waaw » / « déedéet ») : le pilote appuie, ou non, sur le vrai bouton ; le résultat repart vers
     l'assistant, qui le dit et relance (« Am na leneen ? »). Une correction dite à voix haute rappelle le brouillon.
   - Les boutons Oui / Non de la bulle restent possibles : le résultat est alors annoncé à l'assistant par un message.
4. Fin : bouton « Terminer », ou 90 s sans parole.

## Écran

Plus de fil de discussion écrit. Une bulle flottante : un rond animé (j'écoute / je parle / je regarde / je remplis),
« Terminer », et pendant l'accord le résumé de la tâche avec Oui / Non. Le doigt du mode pilote ne change pas.

## Consignes (mode conversation)

Phrases courtes dites comme au comptoir, dans la langue du commerçant ; dire les chiffres soi-même (jamais « je
t'affiche ») ; relancer par une question courte ; rester silencieux pendant que l'écran se remplit ; demander l'accord
avant d'enregistrer.

## Limites connues

- Offre gratuite de Google : nombre de conversations limité ; à passer en offre payante avant d'ouvrir à tous.
- Accent wolof de la voix Google : compréhensible, à juger par le commerçant (échantillons fournis).
- Sur ordinateur sans casque, l'assistant ne s'entend pas lui-même grâce au micro coupé pendant qu'il parle ; on
  l'interrompt en touchant la bulle.

## Tests

- Vitest : protocole Live (lecture des messages, messages envoyés, conversions PCM), `executerOutil`, création de la
  clé temporaire (forme de la requête), consignes du mode conversation, outils du mode direct.
- Essai réel : boutique démo en ligne, micro simulé qui « dit » une question en français puis en wolof ; vérifier la
  voix reçue (retranscription), l'appel d'outil, l'écran qui suit.

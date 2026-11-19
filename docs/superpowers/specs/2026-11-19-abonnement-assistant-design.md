# Abonnement mensuel de l'assistant Finch — conception

Date : 2026-11-19. Statut : validé à l'oral, à relire.

## Objectif

L'application reste vendue en **licence à vie**. L'assistant vocal Finch devient un **abonnement mensuel payant**, à
part : chaque licence (Boutique, Pro, Business) a son offre d'assistant avec un **prix d'activation** (payé une fois),
une **mensualité** et un **nombre de crédits par mois**. L'administrateur encaisse lui-même (Wave, Orange Money,
espèces, virement) et enregistre chaque paiement dans l'administration ; aucun paiement en ligne.

## Décisions

| Sujet | Décision |
|---|---|
| Paiement | Saisi par l'administrateur (comme les licences), montant réellement reçu + moyen + note |
| 1 crédit | 1 conversation (une ouverture de Finch, 15 min au plus) |
| Offre | Fixée par la licence du commerce ; un changement de licence s'applique aux mois suivants |
| Crédits épuisés | Recharge possible : +50 conversations, valables jusqu'à la fin du mois en cours |
| Fin de mois | Les crédits non utilisés sont perdus |
| Essai gratuit (sans licence) | 10 conversations offertes pendant les 14 jours d'essai |
| Démonstration publique | Inchangée : gratuite, 20 conversations par jour |
| Commerce qui a déjà Finch | Aucun mois offert : Finch s'arrête jusqu'au paiement de l'activation et du premier mois |
| Approche | Registre des paiements + fenêtres de crédits (deux tables), état calculé par des fonctions pures |

## Catalogue (`src/lib/domain/plans.ts`, à côté des licences)

| Offre | Activation | Mensualité | Crédits / mois |
|---|---|---|---|
| Boutique | 10 000 F | 5 000 F | 100 |
| Pro | 15 000 F | 10 000 F | 250 |
| Business | 20 000 F | 15 000 F | 500 |

- Recharge : 50 conversations pour 3 000 F.
- Essai : 10 conversations.
- Coût Google estimé par conversation, pour la carte de rentabilité : 50 F, à ajuster avec la première vraie facture.
- Constantes : `ASSISTANT_OFFERS: Record<LicensePackId, { activationPrice; monthlyPrice; monthlyCredits }>`,
  `ASSISTANT_RECHARGE = { credits: 50, price: 3_000 }`, `ASSISTANT_TRIAL_CREDITS = 10`,
  `ASSISTANT_COST_PER_CONVERSATION = 50`, `ASSISTANT_RENEW_MAX_MONTHS = 12`.

## Données (migration Drizzle)

### `assistant_payments` — l'argent reçu

| Colonne | Type | Rôle |
|---|---|---|
| `id` | text, clé | |
| `business_id` | text → businesses, cascade | |
| `kind` | text | `activation` \| `mois` \| `recharge` |
| `months` | integer, 0 par défaut | nombre de mois payés (`mois`) ; 0 sinon |
| `credits` | integer, 0 par défaut | crédits de recharge (`recharge`) ; 0 sinon |
| `amount` | integer | montant réellement reçu, en FCFA |
| `method` | text | `wave` \| `orange_money` \| `especes` \| `virement` \| `autre` |
| `note` | text, nullable | |
| `recorded_by` | text → user, set null | |
| `paid_at` | timestamptz, maintenant par défaut | |
| `created_at` | timestamptz | |

Index sur `business_id`.

### `assistant_months` — les fenêtres de crédits

| Colonne | Type | Rôle |
|---|---|---|
| `id` | text, clé | |
| `business_id` | text → businesses, cascade | |
| `kind` | text | `abonnement` \| `essai` |
| `starts_at` / `ends_at` | timestamptz | fenêtre [début, fin) |
| `credits` | integer | crédits du mois (offre de la licence au moment du paiement, ou 10 pour l'essai) |
| `extra_credits` | integer, 0 par défaut | crédits des recharges |
| `used` | integer, 0 par défaut | conversations ouvertes |
| `payment_id` | text → assistant_payments, set null, nullable | paiement d'origine (null pour l'essai) |
| `created_at` | timestamptz | |

Index sur `(business_id, starts_at)`. Index unique partiel sur `business_id` où `kind = 'essai'` (une seule
fenêtre d'essai par commerce). Contrainte `used <= credits + extra_credits`.

La colonne `businesses.assistant_enabled` n'est plus lue ; elle sera supprimée dans une mise à jour suivante (la
supprimer avant le déploiement ferait planter la version en ligne, qui la lit sur chaque page).

Les deux tables entrent dans les sauvegardes (`src/server/backup/tables.ts`).

## Règles (fonctions pures, `src/lib/domain/assistant/abonnement.ts`)

- **Placement des mois** : `planifierMois(finActuelle, maintenant, n)` rend n fenêtres consécutives d'un mois
  (`addMonths`, même jour du mois suivant). La première commence à `max(maintenant, fin du dernier mois abonnement)` :
  payer en avance ajoute les mois après la fin actuelle, payer après expiration repart d'aujourd'hui.
- **État** : `etatAssistant({ isDemo, plan, months }, maintenant)` rend `{ statut, offre, mois, restants, finLe }`
  avec `statut` parmi :
  - `demo` : boutique de démonstration ;
  - `essai` / `essai_epuise` : essai en cours, avec ou sans crédits (fenêtre d'essai, ou pas encore créée = 10 restants) ;
  - `actif` / `epuise` : un mois d'abonnement couvre maintenant, avec ou sans crédits ;
  - `expire` : au moins un mois d'abonnement a existé, aucun ne couvre maintenant ;
  - `inactif` : sous licence, jamais activé ;
  - `indisponible` : essai fini sans licence, ou commerce suspendu.
  `restants = credits + extra_credits - used` du mois qui couvre maintenant ; `finLe` = fin du dernier mois
  d'abonnement à la suite (mois déjà payés d'avance compris).
- **Ouverture d'une conversation** (`POST /api/assistant/session`, côté serveur, dans cet ordre) :
  1. droits et contexte comme aujourd'hui (connexion, rôle, commerce non suspendu) ;
  2. démonstration : limite du jour (20), sans crédit ;
  3. commerce en essai (sans licence, essai en cours) qui n'a pas encore de fenêtre d'essai : création de la fenêtre
     `[maintenant, fin de l'essai)` à 10 crédits ;
  4. retrait atomique d'un crédit : `update assistant_months set used = used + 1 where business_id = … and
     starts_at <= now and ends_at > now and used < credits + extra_credits returning id, credits + extra_credits - used`.
     Aucune ligne → refus avec le motif calculé par `etatAssistant` (épuisé, expiré, inactif…) ;
  5. limite de sécurité du jour (`ASSISTANT_DAILY_LIMIT`, 60 par défaut) ; dépassée → crédit rendu, refus ;
  6. clé Google ; en cas d'échec (quota, panne, refus) → **crédit rendu** (`used = used - 1` sur la ligne retenue).
  Le refus renvoie un code et un motif lisible par l'application (statut 402 pour un abonnement à payer, 429 pour la
  limite du jour, 503 pour Google), plus les infos de la fiche (offre, prix, crédits, fin).
- **Recharge** : seulement si un mois d'abonnement couvre maintenant ; ajoute `ASSISTANT_RECHARGE.credits` à son
  `extra_credits`.
- **Activation** : seulement pour un commerce sous licence qui n'a jamais payé d'activation ; enregistre la ligne
  `activation` et la ligne `mois` (n mois, 1 par défaut) dans la même transaction.
- **Annulation d'une saisie** : l'administrateur peut supprimer le dernier paiement saisi d'un commerce tant que ses
  crédits n'ont pas servi (mois créés à `used = 0`, ou recharge dont les crédits restent disponibles) ; les fenêtres
  créées (ou les crédits ajoutés) sont retirés avec lui.

## Administration

- **Fiche du commerce → section « Assistant Finch »** (remplace l'interrupteur « Activer l'assistant ») :
  - offre de la licence, statut, crédits restants sur le total du mois, fin de l'abonnement ;
  - boutons **Activer** (activation + 1 à 12 mois), **Renouveler** (1 à 12 mois), **Recharge**, chacun avec un
    formulaire : montants pré-remplis aux prix catalogue (multipliés par le nombre de mois), modifiables ; moyen ;
    note. Les boutons absents quand ils ne s'appliquent pas (Activer déjà fait, Recharge sans mois en cours…) ;
  - historique des paiements (date, type, mois ou crédits, montant, moyen, qui) avec « Annuler » sur le dernier
    quand c'est permis.
  Chaque saisie et chaque annulation écrit une ligne dans le journal (`admin_audit_log`).
- **Accueil de l'administration** :
  - liste **« Assistant : à renouveler »** : abonnements qui finissent dans les 7 jours sans mois payé ensuite, et
    abonnements expirés depuis moins de 30 jours (commerce, téléphone, fin, crédits utilisés le dernier mois) ;
  - carte **« Rentabilité de l'assistant »** du mois en cours (calendrier, Dakar = UTC) : encaissé (somme des
    paiements du mois), conversations (somme des compteurs du jour `assistant_usage` du mois, hors démonstrations ;
    ce compteur avance après le retrait du crédit, il compte donc les conversations ouvertes plus les rares échecs de
    Google), coût Google estimé (conversations × coût par conversation), marge.

## Commerçant

- **Bouton micro** : affiché pour tout commerce dont le statut n'est pas `indisponible` (démo, essai, actif, épuisé,
  expiré, inactif). Pour `essai_epuise`, `epuise`, `expire`, `inactif`, un toucher ouvre une **fiche** au lieu de la
  conversation :
  - inactif : présentation de Finch et de l'offre de sa licence (activation, mensualité, crédits) ;
  - épuisé : « Tu as utilisé tes N conversations de ce mois », recharge (50 pour 3 000 F) ou attendre la fin du mois ;
  - expiré : « Ton abonnement à Finch est terminé depuis le … », mensualité ;
  - essai épuisé : les 10 conversations sont utilisées ; Finch vient avec la licence et l'abonnement.
  Bouton **WhatsApp** vers Sama Stock, message pré-rempli (« Bonjour, je veux activer / renouveler / recharger Finch
  pour <boutique> (licence <pack>). »). Le numéro vient de `NEXT_PUBLIC_WHATSAPP_SAMA_STOCK` (chiffres
  internationaux) ; sans lui, le bouton est caché et la fiche dit « Contacte Sama Stock ».
  Un refus du serveur à l'ouverture (crédits partis entre-temps) ouvre la même fiche.
- **Plein écran de la conversation** : « N conversations restantes » discret en bas, orange à partir de 10
  (essai : « N conversations d'essai »).
- **Page « Licence »** : carte « Assistant Finch » (offre, statut, fin, barre des crédits, historique des paiements
  sans le nom de l'administrateur, bouton WhatsApp). Les montants ne sont visibles que pour le propriétaire et les
  gérants ; les employés voient seulement si Finch est disponible.

## Notifications

- Nouveau type `assistant`, nouveau sujet de réglage « Assistant Finch » (« Fin de l'abonnement et crédits presque
  épuisés »), destiné aux rôles déjà notifiés (propriétaire, gérant).
- À l'ouverture d'une conversation, pour un mois d'abonnement seulement (pas l'essai) : quand il reste exactement
  10 crédits → « Plus que 10 conversations avec Finch ce mois-ci » ; quand il reste 0 → « Tu as utilisé toutes tes
  conversations de Finch ce mois-ci ».
- Tâche quotidienne `GET /api/assistant/rappels` (planificateur Vercel, `0 9 * * *`, 9 h à Dakar, protégée par
  `CRON_SECRET` comme la tâche de nuit) :
  - abonnement qui finit dans 3 jours sans mois payé ensuite → « Ton abonnement Finch se termine le … » ;
  - abonnement terminé dans les dernières 24 h sans mois ensuite → « Ton abonnement Finch est terminé ».
  Jamais pour les démonstrations.

## Mise en service

1. Appliquer la migration sur la base Neon **avant** l'envoi sur GitHub (ordre du LISEZ-MOI).
2. Ajouter `NEXT_PUBLIC_WHATSAPP_SAMA_STOCK` dans les variables Vercel (fourni par le propriétaire).
3. Envoyer le code : Vercel déploie, la tâche `rappels` est déclarée dans `vercel.json`.
4. Le commerce sous licence qui a aujourd'hui Finch le perd jusqu'à l'activation : le propriétaire le prévient avant.

## Erreurs et cas limites

- Deux téléphones ouvrent Finch sur le dernier crédit : le retrait atomique n'en laisse passer qu'un.
- Échec Google ou limite du jour après le retrait : crédit rendu.
- Changement de licence : le mois en cours garde ses crédits ; les mois payés ensuite prennent l'offre de la nouvelle.
- Licence retirée ou commerce suspendu : `indisponible`, mois déjà payés conservés (ils reprennent si la situation
  revient avant leur fin).
- Montant saisi différent du catalogue (remise) : accepté, c'est le montant reçu qui compte pour la rentabilité.
- Renouvellement au-delà de 12 mois en une saisie : refusé (faire plusieurs saisies).

## Tests

- Unitaires (Vitest) : catalogue ; `planifierMois` (en avance, après expiration, fin de mois 31 → 30) ;
  `etatAssistant` (tous les statuts, essai sans fenêtre, mois payés d'avance, changement de licence) ; calcul de la
  carte de rentabilité ; texte et lien WhatsApp de la fiche ; montants pré-remplis des formulaires.
- Les tests existants continuent de passer (outils, consignes, contexte).
- Vérification manuelle en local sur une boutique de démonstration remise en licence : activer, renouveler en avance,
  recharger, épuiser (fiche), Google en panne simulée (crédit rendu), annuler la dernière saisie, rappels.

## Hors périmètre

- Reçus PDF des paiements de l'assistant.
- Paiement en ligne (Wave, Orange Money via un prestataire).
- Offre d'assistant choisie indépendamment de la licence ; report des crédits non utilisés.
- Suppression de la colonne `assistant_enabled` (mise à jour suivante).

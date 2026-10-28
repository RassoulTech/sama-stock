# Sauvegardes et alertes de panne — conception

Date : 2026-10-28. Choix validés par l'utilisateur :
- rester sur les offres gratuites (Neon free, Vercel Hobby) ;
- une sauvegarde complète **chaque nuit**, un fichier par boutique et un fichier pour l'espace admin ;
- rangement dans **deux coffres** : un coffre privé Vercel Blob (boutons dans l'admin) et une copie de secours GitHub ;
- sauvegardes et restaurations réservées au super admin (pas de « Télécharger mes données » pour le propriétaire) ;
- pannes : page d'erreur en français, alerte **téléphone + e-mail**, page Admin › Pannes ; ajout d'une table accepté.

Pourquoi pas une copie « en temps réel » hors de Neon : une réplication logique garde le calcul Neon allumé jour et nuit
(environ 180 CU-heures par mois à 0,25 CU), au-delà des 100 CU-heures de l'offre gratuite : la base s'arrêterait en
milieu de mois. La protection à la seconde reste celle de Neon (retour à n'importe quel instant des 6 dernières heures,
pour toute la base).

## Niveaux de protection

| Problème | Solution | Perte maximale |
| --- | --- | --- |
| Erreur découverte dans les 6 h | Retour de toute la base à la seconde près (Neon, fait par le développeur) | aucune |
| Erreur dans une boutique, découverte plus tard | Admin › Sauvegardes › restaurer **cette boutique** à une nuit | depuis cette nuit, pour cette boutique |
| Base Neon perdue | Nouvelle base + script de restauration totale depuis le coffre Vercel | depuis la dernière nuit |
| Base Neon et compte Vercel perdus | Même script, depuis la copie GitHub | depuis la dernière nuit copiée |

## Contenu des sauvegardes

Fichiers JSON compressés (gzip). Lignes lues avec Drizzle (noms des propriétés Drizzle) ; les dates sont écrites en
ISO et reconverties à la restauration d'après le type de la colonne. Format versionné (`format: 1`) avec le nom de la
dernière migration appliquée.

**Fichier boutique** `boutique-<businessId>.json.gz` :
- `businesses` (la ligne), `locations`, `categories`, `products` (photos comprises), `stock_levels`, `stock_movements`,
  `suppliers`, `purchases`, `purchase_items`, `customers`, `sales`, `sale_items`, `customer_payments`, `documents`,
  `document_items`, `members` (codes PIN chiffrés compris), `shop_devices`, `invitations` ;
- `users` : le propriétaire et les membres ; `accounts` de ces utilisateurs, **sans** `access_token`, `refresh_token`,
  `id_token` (le mot de passe chiffré est gardé) ;
- `counts` : nombre de lignes par table (affiché dans l'admin et comparé avant une restauration).

**Fichier admin** `admin.json.gz` : `license_sales`, `license_payments`, `business_notes`, `admin_audit_log`, les
utilisateurs super admin (`ADMIN_EMAILS`) et leurs `accounts` (mêmes exclusions), et la liste des commerces (id, nom,
slug, licence) pour s'y retrouver.

**Jamais sauvegardé** : boutiques de démonstration, `notifications`, `push_subscriptions`, `session`, `verification`,
`subscription_events`, `subscription_checkouts` (anciens abonnements, inutilisés), `app_errors`.

## Rangement (coffre Vercel Blob, privé)

Une « passe » = un dossier `sauvegardes/<passe>/` où `<passe>` vaut `2026-10-29T02-04Z-nuit`, `…-manuelle` ou
`…-avant-restauration`. Il contient `sommaire.json` et les fichiers.

`sommaire.json` : passe, type, début, fin, état (`ok` | `partiel` | `echec`), migration, et pour chaque fichier : type
(boutique | admin), commerce, nom, chemin, taille, empreinte SHA-256 du JSON, `counts`, et `identiqueA` (chemin du
fichier d'une passe précédente quand le contenu n'a pas changé : rien n'est recopié). Le sommaire est rangé avec les
sauvegardes, pas dans la base : il reste lisible si Neon disparaît.

`github.json` (écrit quand GitHub a fini de copier la passe) : date de la copie.

**Conservation** : les passes « nuit » des 30 derniers jours, plus la première passe « nuit » de chaque mois pendant 12
mois ; les passes « manuelle » et « avant-restauration » 30 jours. Un fichier référencé par `identiqueA` d'une passe
gardée n'est jamais effacé.

**Stockage local** : sans `BLOB_READ_WRITE_TOKEN` (ordinateur de développement), le même code range les passes dans le
dossier `.sauvegardes-local/` (ignoré par git). Ce mode est refusé sur Vercel.

## Déclenchement

- **Chaque nuit** : tâche planifiée Vercel (`vercel.json` → `crons`, `0 2 * * *`, soit 2 h à Dakar ; sur Hobby elle
  part dans l'heure) vers `/api/sauvegardes/nuit`. La route exige `Authorization: Bearer <CRON_SECRET>` (comparaison
  en temps constant), fait la passe, efface les passes trop anciennes, puis vérifie la copie GitHub : alerte si la
  dernière copie a plus de 48 h alors qu'une passe de plus de 48 h existe. Durée maximale de la fonction : 300 s.
- **À la main** : bouton « Sauvegarder maintenant » (action super admin).
- **Avant chaque restauration** : passe « avant-restauration » de la boutique concernée (ou du fichier admin).

Une passe ratée (ou partielle : une boutique en échec) crée une panne de source `sauvegarde` (voir Pannes), donc une
alerte.

## Copie de secours GitHub

Workflow `.github/workflows/sauvegarde.yml` dans le dépôt privé `RassoulTech/sama-stock` : chaque nuit à 3 h 30 UTC et
à la demande (`workflow_dispatch`).
1. `GET /api/sauvegardes/derniere` (Bearer `SAUVEGARDE_CLE`, même valeur que `CRON_SECRET`) → sommaire de la dernière
   passe « nuit » réussie ;
2. pour chaque fichier (`identiqueA` résolu), `GET /api/sauvegardes/fichier?chemin=…` (même clé) ;
3. `actions/upload-artifact`, nom `sauvegarde-<passe>`, conservation 30 jours ;
4. `POST /api/sauvegardes/github-ok?passe=…` (même clé) → écrit `github.json`.

Le mot de passe de la base ne sort jamais de Vercel : GitHub n'a que la clé de téléchargement. En cas d'échec, GitHub
envoie lui-même un e-mail au propriétaire du dépôt.

## Page Admin › Sauvegardes (`/admin/sauvegardes`, groupe « Sécurité »)

- En haut : dernière passe (date, état, nombre de boutiques, taille), dernière copie GitHub, place totale utilisée.
- Bouton « Sauvegarder maintenant ».
- Liste des passes, la plus récente en premier ; dépliée : chaque boutique (taille, produits, ventes, clients) avec
  **Télécharger** (`/api/admin/sauvegardes/fichier`) et **Restaurer**, puis le fichier admin avec les mêmes boutons.
- **Restaurer depuis un fichier** (copie GitHub) : envoi direct du navigateur vers le coffre (`@vercel/blob/client`,
  route `/api/admin/sauvegardes/envoi` réservée au super admin) dans `sauvegardes/importes/`, puis même restauration.

### Restaurer une boutique

Fenêtre de confirmation : comparaison des `counts` sauvegardés et actuels (« 1 240 ventes aujourd'hui, 1 228 après :
12 ventes faites depuis seront effacées », idem factures, produits, clients) ; il faut retaper le nom de la boutique.
Les factures émises depuis cette nuit disparaissent et leurs numéros peuvent être redonnés : la fenêtre le dit.

Déroulement (`restoreShop`, super admin) :
1. verrou consultatif propre au commerce ; vérification du format et de la migration (refus si le fichier vient d'une
   migration plus récente que la base) ;
2. passe « avant-restauration » de l'état actuel (annulation possible en la restaurant) ;
3. dans une transaction :
   - suppression des lignes de la boutique, des tables filles vers les tables mères : `document_items`, `documents`,
     `customer_payments`, `sale_items`, `sales`, `purchase_items`, `purchases`, `stock_movements`, `stock_levels`,
     `products`, `categories`, `customers`, `suppliers`, `invitations`, `shop_devices`, `members`, `locations` ;
   - la ligne `businesses` est mise à jour (ou créée si le commerce n'existe plus) **en gardant les valeurs actuelles**
     de ce que gère l'admin : `plan`, `trial_ends_at`, `period_ends_at`, `suspended_at`, `is_demo`, `demo_reset_at`,
     `license_pack`, `license_activated_at`, `maintenance_ends_at`, `slug`, `brand_color` ; `sale_counter` et
     `order_counter` prennent le plus grand des deux (jamais un numéro de vente redonné) ;
   - utilisateurs et `accounts` absents recréés ; un utilisateur existant n'est **jamais** modifié (son mot de passe
     actuel reste) ;
   - insertion par paquets, des tables mères vers les filles ; `sales.replaces_id` remis dans un second temps ; une
     colonne qui désigne un utilisateur inexistant est mise à `null` ; colonnes ajoutées depuis : valeur par défaut ;
4. ligne dans le journal admin (`restauration`, passe, fichier).

Les licences, paiements de licences, notes et le journal ne sont pas touchés par la restauration d'une boutique.

### Restaurer les données admin

Même principe pour `license_sales`, `license_payments`, `business_notes`, `admin_audit_log` : passe
« avant-restauration » du fichier admin, puis remplacement de toutes les lignes de ces tables. Les lignes d'un commerce
qui n'existe plus sont ignorées (licences, paiements, notes) ou gardées sans commerce (journal). Une ligne « restauration
admin » est ajoutée au journal après le remplacement.

## Restauration totale (catastrophe)

Script `scripts/restaurer-tout.ts` (`npx tsx`), lancé par le développeur avec l'accord de l'utilisateur : base cible
vide (migrations appliquées d'abord), source = coffre Vercel (passe choisie) ou dossier local décompressé depuis
l'artefact GitHub. Ordre : utilisateurs super admin, chaque boutique, fichier admin. Marche à suivre écrite dans
`docs/sauvegardes.md`.

## Pannes

### Données (migration 0012, ajout seulement)

`app_errors` : `id`, `fingerprint` (unique), `source` (`serveur` | `navigateur` | `sauvegarde`), `route`, `message`
(500 caractères au plus), `digest`, `count`, `first_seen_at`, `last_seen_at`, `alerted_at`, `resolved_at`. Aucune donnée
personnelle (pas d'e-mail, pas de téléphone, pas de contenu de formulaire).

Empreinte : SHA-1 de source + route + message normalisé (chiffres → `#`, identifiants → `:id`).

### Capture

- Serveur : `src/instrumentation.ts`, `onRequestError` (environnement Node) → `reportError`. Ignorés : les erreurs
  attendues montrées à l'utilisateur (`ActionError`), et les contrôles de Next.js (redirection, page introuvable).
- Navigateur : `src/app/error.tsx`, `src/app/(app)/error.tsx` (garde le menu), `src/app/admin/error.tsx` et
  `src/app/global-error.tsx` envoient `POST /api/erreurs` (message, `digest`, page ; 2 Ko au plus) → `reportError`.
  Pas d'envoi quand le téléphone est hors ligne : la page dit alors « Pas d'internet ».
- Sauvegarde : passe ratée ou partielle, copie GitHub absente depuis 48 h.

### Alerte

`reportError` ajoute ou met à jour la ligne (`count + 1`, `last_seen_at`). Une alerte part si la panne est nouvelle, si
elle revient après avoir été marquée « Réglée », ou si elle revient après plus de 24 h de calme. Envoi après la réponse
(`after`) :
- **téléphone** : notification aux abonnements `push_subscriptions` des utilisateurs super admin (fonction `sendPush`
  existante), qui ouvre `/admin/pannes` ;
- **e-mail** à `LEGAL.email` (digigeek221@gmail.com) via `src/server/mail.ts`, seulement si `SMTP_USER` / `SMTP_PASS`
  existent.

Si la base ne répond pas (la ligne ne peut pas être écrite) : e-mail seul, au plus un par empreinte et par heure pour
chaque serveur (mémoire).

Texte : « Panne sur Sama Stock — /vendre (serveur) : <message court>. 1re fois. Voir : <site>/admin/pannes ».

### Page d'erreur

En français, aux couleurs de Sama Stock : « Un problème est survenu », boutons **Réessayer** (`retry`), **Retour à
l'accueil**, **Nous écrire sur WhatsApp** (numéro d'assistance), et « Code : <6 premiers caractères du digest> » pour
retrouver la panne. `global-error.tsx` a ses propres `<html>` et `<body>` et des styles intégrés, clair et sombre.

### Admin

- Carte « Alertes sur ce téléphone » (tableau de bord admin et page Pannes) : activer, désactiver, envoyer un essai.
  Actions super admin qui écrivent dans `push_subscriptions` pour l'utilisateur admin (pas besoin de commerce).
- Page `/admin/pannes` (groupe « Sécurité ») : pannes non réglées d'abord ; route, source, message, nombre, première
  et dernière fois ; bouton « Réglée ». Pastille rouge dans le menu tant qu'il en reste.

## Réglages à faire par l'utilisateur (guidé)

1. Créer le coffre Vercel Blob **privé** relié au projet (tableau de bord, ou commande `vercel blob create-store
   --access private` avec son accord) : `BLOB_READ_WRITE_TOKEN` est alors ajouté par Vercel.
2. `CRON_SECRET` : générée dans `.env` sans être affichée ; l'utilisateur la copie dans Vercel (Production) et dans
   GitHub (Settings › Secrets › Actions, nom `SAUVEGARDE_CLE`).
3. `SMTP_USER` / `SMTP_PASS` dans Vercel (e-mails d'alerte et mot de passe oublié).
4. Activer « Alertes sur ce téléphone » dans l'admin.

## Limites connues

- Hobby : une tâche planifiée par jour au plus, lancée dans l'heure ; fonction limitée à 300 s (assez pour des
  dizaines de boutiques ; au-delà, découper la passe).
- La place gratuite du coffre Vercel est limitée : la page affiche la place utilisée ; une boutique inchangée n'est
  pas recopiée.
- L'offre Hobby de Vercel est prévue pour un usage non commercial : la copie GitHub protège les données si le compte
  était suspendu.

## Tests

- Unitaires : empreinte des pannes, choix des passes à effacer (conservation), écriture / relecture d'un fichier
  (dates, nombres, JSON), colonnes gardées à la restauration, comparaison des `counts`.
- Restauration testée **sur une branche Neon temporaire** (copie de la base, supprimée après), jamais sur la vraie
  base : passe → modification de « Boutique Test » → restauration → comparaison ligne à ligne.
- Navigateur (scratchpad) : page Admin › Sauvegardes, page d'erreur, page Pannes, alerte d'essai.

# Sauvegardes de Sama Stock — marche à suivre

## Ce qui est sauvegardé, où, combien de temps

- **Chaque nuit vers 2 h** (heure de Dakar), le site fait une sauvegarde complète : un fichier par boutique (produits
  et photos, stock, ventes, clients et crédits, fournisseurs, devis et factures, équipe et codes PIN chiffrés,
  appareils) et un fichier pour l'espace admin (licences, paiements de licences, notes, journal, comptes admin).
  Les boutiques de démonstration ne sont pas sauvegardées.
- **Où :**
  1. dans le **coffre privé Vercel** (Storage › Blob) : c'est là que la page Admin › Sauvegardes lit et restaure ;
  2. **chez GitHub**, vers 3 h 30 : une copie **chiffrée**, gardée 30 jours (onglet Actions du dépôt, « Sauvegarde de
     secours », fichiers « sauvegarde-… »). Elle ne s'ouvre qu'avec la **clé de secours**.
- **Combien de temps :** les 30 dernières nuits, plus la première nuit de chaque mois pendant un an.
- **Neon** garde en plus tout l'historique de la base des **6 dernières heures**, à la seconde près.

## La clé de secours

Fichier `cle-de-secours-sauvegardes.pem`, dans le dossier `Sama Stock - cle de secours` (à côté du projet, jamais
dedans). C'est la seule clé qui ouvre les copies GitHub.

- Gardez une copie sur une **clé USB** et une dans votre **Google Drive** (dossier privé).
- Ne l'envoyez jamais par WhatsApp ou e-mail, ne la mettez jamais dans GitHub ni dans Vercel.
- Perdue ? Une nouvelle paire de clés peut être créée ; les anciennes copies GitHub deviennent illisibles, mais le
  coffre Vercel reste utilisable.

## Cas 1 — Une boutique a fait une erreur (supprimé, mal modifié…)

1. Admin › **Sauvegardes**, ouvrir la nuit voulue (« Voir »).
2. Sur la ligne de la boutique : **Restaurer**. La fenêtre montre ce qui va changer (ventes, factures, clients…).
3. Retaper le nom de la boutique, puis **Restaurer**.

Seule cette boutique revient à cette date : les autres boutiques, sa licence et son adresse ne bougent pas. Une copie
de son état juste avant est gardée (« Avant restauration ») : on peut donc revenir en arrière de la même façon.

Erreur découverte **dans les 6 heures** et qui touche plusieurs boutiques : demander au développeur un retour de
toute la base à la minute près (Neon › Branches › Restore).

## Cas 2 — Erreur dans l'admin (licence, paiement, note supprimés)

Admin › Sauvegardes › ligne « Espace admin » › Restaurer › taper `ADMIN`. Les boutiques ne sont pas touchées.

## Cas 3 — Catastrophe : la base Neon est perdue

À faire par le développeur, avec la clé de secours :

1. Créer une nouvelle base Neon (même région, `aws-eu-central-1`).
2. Mettre sa chaîne de connexion dans `.env` (`DATABASE_URL=…`), puis créer les tables : `npx drizzle-kit migrate`.
3. Récupérer la dernière copie : GitHub › Actions › « Sauvegarde de secours » › dernier passage réussi › artefact
   `sauvegarde-…` › télécharger et décompresser dans un dossier.
4. Lancer : `npx tsx --conditions=react-server scripts/restaurer-tout.ts <dossier>`
   (la clé de secours est cherchée dans `../Sama Stock - cle de secours/` ; sinon donner son chemin en 2e argument).
5. Mettre la nouvelle `DATABASE_URL` dans Vercel (Settings › Environment Variables), redéployer, vérifier le site.

Exercice fait le 28/10/2026 sur une copie vidée de la base : 9 boutiques et l'espace admin remis en 30 secondes,
identiques à la sauvegarde.

## Réglages nécessaires (une seule fois)

| Où | Quoi |
| --- | --- |
| Vercel › Storage | Coffre **Blob** en accès **Private**, relié au projet (ajoute `BLOB_READ_WRITE_TOKEN`) |
| Vercel › Settings › Environment Variables | `CRON_SECRET` (copié depuis `.env`) |
| GitHub › Settings › Secrets and variables › Actions | secret `SAUVEGARDE_CLE` = la même valeur que `CRON_SECRET` |

Une sauvegarde ratée, incomplète, ou l'absence de copie GitHub depuis 2 jours déclenche une alerte de panne
(téléphone de l'administrateur et e-mail).

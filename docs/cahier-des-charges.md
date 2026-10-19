# Cahier des charges — Sama Stock (MVP)

*Version 1.0 — 19 octobre 2026 — statut : **validé** le 19 octobre 2026*

---

## 1. Objectif

**Sama Stock** est une application web (SaaS par abonnement) qui permet aux commerçants sénégalais de **savoir à tout moment ce qu'il leur reste en stock et d'être prévenus avant la rupture**, qu'ils vendent en boutique ou en ligne (WhatsApp, Instagram, TikTok…).

Autour de ce cœur, l'application aide à :

- enregistrer les ventes en boutique et les commandes en ligne, avec un reçu envoyé par WhatsApp ;
- suivre les ventes à crédit et relancer les clients qui doivent de l'argent ;
- repérer les pertes et les vols grâce à l'inventaire ;
- connaître son vrai bénéfice et ses meilleurs produits ;
- faire travailler ses employés avec des droits limités.

**Positionnement :** *« La gestion de stock des commerçants sénégalais — en boutique comme en ligne. »* Aucun outil local ne couvre aujourd'hui à la fois la boutique physique et la vente en ligne, en français, avec Wave / Orange Money (voir la recherche de la phase 2).

**Objectif du MVP :** une version complète et utilisable, testable en local sur l'ordinateur, puis déployable sur Vercel pour des démonstrations. Le vrai paiement de l'abonnement est branché ensuite, au passage en production.

---

## 2. Utilisateurs

### 2.1 Les commerces ciblés

| Profil | Exemple | Ce dont il a le plus besoin |
|---|---|---|
| **E-commerçant** | Vend des vêtements, cosmétiques, accessoires sur WhatsApp / Instagram / TikTok | Suivre les commandes, ne pas vendre un produit qu'il n'a plus |
| **Boutique** | Supérette, boutique de quartier, boutique de mode | Caisse rapide, ventes à crédit, alertes de rupture |
| **Quincaillerie** | Ciment, fer, peinture, plomberie, électricité | Unités variées (sac, mètre, kg…), marges, inventaire |

Marché : **Sénégal** — interface en **français**, montants en **FCFA** (sans centimes), téléphones au format **+221**, fuseau horaire de Dakar.

### 2.2 Les rôles dans un commerce

| Rôle | Qui | En résumé |
|---|---|---|
| **Propriétaire** | Le patron qui a créé le compte | Voit et fait tout, y compris l'abonnement et l'équipe |
| **Gérant** | Bras droit du patron | Tout, sauf l'abonnement, l'équipe et les paramètres du commerce |
| **Vendeur** | Employé au comptoir ou qui gère les messages WhatsApp | Vend, gère les commandes et les clients — **ne voit jamais les prix d'achat ni les bénéfices** |
| **Magasinier** | Employé de la réserve / du dépôt | Entrées, sorties, inventaire et transferts de stock — **en quantités seulement**, sans prix d'achat |

### 2.3 Tableau détaillé des droits

| Action | Propriétaire | Gérant | Vendeur | Magasinier |
|---|:-:|:-:|:-:|:-:|
| Tableau de bord complet (chiffre d'affaires, bénéfice, valeur du stock) | ✓ | ✓ | — | — |
| Tableau de bord simplifié (ses ventes du jour, alertes de stock) | ✓ | ✓ | ✓ | ✓ |
| Vendre en boutique (caisse) | ✓ | ✓ | ✓ | — |
| Annuler une vente | ✓ | ✓ | — | — |
| Créer une commande en ligne, changer son statut | ✓ | ✓ | ✓ | — |
| Voir les produits et le stock | ✓ | ✓ | ✓ *(sans prix d'achat)* | ✓ *(sans prix d'achat)* |
| Créer / modifier / archiver un produit | ✓ | ✓ | — | — |
| Entrée de stock / achat fournisseur | ✓ *(avec prix)* | ✓ *(avec prix)* | — | ✓ *(quantités seulement)* |
| Sortie, ajustement (casse, vol, perte), inventaire | ✓ | ✓ | — | ✓ |
| Transfert entre boutiques (formule Business) | ✓ | ✓ | — | ✓ |
| Clients, crédits, remboursements, rappels WhatsApp | ✓ | ✓ | ✓ | — |
| Fournisseurs | ✓ | ✓ | — | ✓ *(consulter)* |
| Prix d'achat, marges, bénéfices | ✓ | ✓ | — | — |
| Rapports avancés (Pro / Business) | ✓ | ✓ | — | — |
| Équipe : inviter, changer un rôle, retirer | ✓ | — | — | — |
| Abonnement | ✓ | — | — | — |
| Paramètres du commerce (nom, logo, boutiques, modules) | ✓ | — | — | — |

### 2.4 Vous : le super-administrateur

Vous (propriétaire du SaaS) avez un espace réservé pour superviser tous les commerces inscrits (voir § 3.12).

---

## 3. Fonctionnalités du MVP

### 3.1 Site public et inscription

- **Page d'accueil** présentant Sama Stock : bénéfices, fonctionnalités, tarifs, bouton « Essai gratuit 14 jours ».
- **Inscription / connexion** :
  - par **email + mot de passe** ;
  - par **« Continuer avec Google »** (actif dès que la clé Google est configurée — je vous guiderai pour la créer).
- **Démarrage guidé** après l'inscription (2 minutes) : nom du commerce, type d'activité (e-commerce, boutique, quincaillerie, autre), téléphone, ville. Le type d'activité active automatiquement les bons modules (voir § 3.11).

### 3.2 Produits

- Fiche produit : **nom**, **photo** (facultative, compressée automatiquement), **catégorie**, **référence** (facultative), **unité de vente** (pièce, kg, mètre, litre, sac, carton, paquet, boîte, rouleau…), **prix d'achat**, **prix de vente**, **seuil d'alerte**, **stock de départ**.
- Les quantités acceptent les décimales pour les unités qui s'y prêtent (ex. 2,5 m de câble, 1,5 kg).
- **Marge affichée** sur la fiche (en FCFA et en %) — visible seulement par Propriétaire et Gérant.
- **Alerte « vente à perte »** si le prix de vente est inférieur au prix d'achat.
- **Recherche rapide** par nom ou référence, filtres par catégorie et par état de stock (en stock / stock bas / rupture).
- **Archiver** un produit (il disparaît des listes mais l'historique est conservé).
- Gestion simple des **catégories**.

### 3.3 Stock et mouvements

- **Stock actuel** de chaque produit, par boutique / dépôt.
- **Indicateurs visuels** : vert (en stock), orange (stock bas, sous le seuil d'alerte), rouge (rupture).
- **Stock disponible** = stock physique − quantités réservées par les commandes en ligne en cours.
- **Entrée de stock / achat fournisseur** : fournisseur (facultatif), produits, quantités, prix d'achat unitaire. Le prix d'achat du produit est recalculé en **coût moyen** *(exemple : 10 sacs achetés à 4 000 FCFA puis 10 sacs à 5 000 FCFA → coût retenu 4 500 FCFA)*. Une entrée faite par un Magasinier (quantités seulement) conserve le coût actuel du produit.
- **Sortie manuelle** avec motif (vendu hors caisse, utilisé, offert, autre) — utile si le commerçant n'utilise pas la caisse.
- **Ajustement** avec motif obligatoire : **casse, vol, perte, péremption, erreur de saisie**.
- **Inventaire** : écran listant les produits avec la quantité attendue ; le commerçant saisit ce qu'il a compté ; à la validation, les écarts sont enregistrés comme ajustements « inventaire » et un résumé des pertes est affiché (en quantité et, pour Propriétaire / Gérant, en FCFA).
- **Transferts entre boutiques / dépôts** (formule Business).
- **Historique complet** de tous les mouvements : date, type, produit, quantité, motif, qui l'a fait.

### 3.4 Ventes en boutique (caisse) — module facultatif

- Écran de caisse pensé pour le téléphone : recherche, grille de produits avec photo, panier, quantités modifiables.
- **Remise** facultative sur le total.
- **Client** facultatif (obligatoire pour une vente à crédit).
- **Mode de paiement** : Espèces, Wave, Orange Money, Free Money, Carte, **Crédit**. Paiement **partiel** possible : le reste devient une dette du client.
- **Rendu monnaie** calculé pour les espèces.
- Le stock baisse automatiquement à la validation.
- **Reçu** à l'écran (numéro V-0001, date, articles, total, payé, reste, mode, vendeur) avec boutons **« Envoyer sur WhatsApp »** (message pré-rempli vers le numéro du client) et **« Imprimer / PDF »** (impression navigateur).
- **Annulation** d'une vente (Propriétaire / Gérant) : le stock est remis automatiquement.
- On ne peut pas vendre plus que le stock disponible (message clair).

### 3.5 Commandes en ligne — module facultatif

- Création : **client** (nom + téléphone), **canal** (WhatsApp, Instagram, TikTok, Facebook, Site web, Téléphone, Autre), produits, **adresse et frais de livraison**, note.
- Suivi par étapes :

  ```
  Nouvelle → En préparation → En livraison → Livrée
                     ↘ Annulée            ↘ Retournée
  ```

- **Effet sur le stock** :
  - *Nouvelle / En préparation* : les produits sont **réservés** (ils ne peuvent plus être vendus à quelqu'un d'autre) ;
  - *En livraison* : les produits **sortent** du stock ;
  - *Annulée* (avant livraison) : la réservation est libérée ;
  - *Retournée* (après départ) : les produits **reviennent** en stock.
- **Paiement** de la commande : non payée / payée (mode de paiement), paiement partiel possible ; une commande livrée non soldée devient une dette du client.
- Vue **liste** filtrable par statut et par canal, avec compteur des commandes en cours.
- Bouton **« Envoyer le récapitulatif sur WhatsApp »** au client.

### 3.6 Clients et crédit

- Fiche client : nom, téléphone, adresse (facultative), note.
- **Solde dû** calculé automatiquement (ventes et commandes non soldées − remboursements).
- **Historique** des achats et des remboursements.
- **Enregistrer un remboursement** (montant, mode de paiement, date).
- **« Rappeler par WhatsApp »** en un clic : message pré-rempli poli avec le montant dû.
- Liste des clients **triable par montant dû**, et total des créances visible sur le tableau de bord.

### 3.7 Fournisseurs

- Fiche fournisseur : nom, téléphone, note.
- Historique des achats (entrées de stock) réalisés chez ce fournisseur, et montant total acheté.

### 3.8 Tableau de bord

**Pour tous les rôles :**
- produits en **stock bas** et en **rupture**, avec bouton « Réapprovisionner » ;
- commandes en cours (si le module est actif).

**Pour Propriétaire et Gérant, en plus :**
- chiffre d'affaires du jour / de la semaine / du mois ;
- nombre de ventes ;
- bénéfice brut du mois ;
- total des crédits clients ;
- valeur du stock (au prix d'achat).

**Pour le Vendeur :** ses propres ventes du jour.

### 3.9 Rapports avancés (formules Pro et Business)

- Évolution des ventes et du bénéfice (graphique jour / semaine / mois, avec choix de période).
- **Meilleurs produits** (par quantité vendue et par bénéfice).
- **Produits dormants** (aucune vente depuis 30 jours).
- Ventes **par canal** (boutique, WhatsApp, Instagram, TikTok…).
- Ventes **par mode de paiement** (espèces, Wave, Orange Money…).
- Pertes enregistrées (casse, vol, perte) sur la période.

### 3.10 Équipe

- **Inviter** un employé : nom, email, rôle → l'application génère un **lien d'invitation** que le propriétaire copie ou **envoie par WhatsApp** (pas besoin de service d'email dans le MVP). Le lien expire après 7 jours.
- L'employé ouvre le lien, crée son compte avec l'email indiqué dans l'invitation (mot de passe ou Google) et arrive directement dans le commerce avec son rôle.
- **Changer le rôle**, **retirer** un employé, **annuler** une invitation.
- **Limite selon la formule** : au-delà, message « Passez à la formule supérieure » avec bouton vers l'abonnement. Les invitations en attente comptent dans la limite.

### 3.11 Paramètres du commerce

- Nom, logo, téléphone, adresse, ville (repris sur les reçus).
- **Modules** activables à tout moment : « Caisse (ventes en boutique) » et « Commandes en ligne ». La gestion de stock est toujours active. Valeurs par défaut selon le type d'activité :
  - e-commerce → Commandes ✓, Caisse ✗ ;
  - boutique / quincaillerie → Caisse ✓, Commandes ✗ ;
  - autre → les deux ✓.
- **Boutiques / dépôts** : nom et type. Une seule en Essai et Pro, jusqu'à 3 en Business. Quand il y en a plusieurs, un sélecteur en haut de l'écran permet de choisir la boutique active.
- Mode clair / sombre.

### 3.12 Abonnements

| | **Essai** | **Pro** | **Business** |
|---|---|---|---|
| Prix | 0 FCFA pendant 14 jours | 5 000 FCFA / mois | 11 500 FCFA / mois |
| Produits actifs | 20 | 50 | illimité |
| Employés (hors propriétaire) | 0 | 3 | illimité |
| Boutiques / dépôts | 1 | 1 | 3 |
| Rapports avancés | — | ✓ | ✓ |
| Stock, caisse, commandes, crédit, fournisseurs, inventaire | ✓ | ✓ | ✓ |

- À l'inscription : **essai de 14 jours**. Un bandeau affiche les jours restants.
- À la fin de l'essai (ou d'une période payée non renouvelée) : le compte passe en **consultation seule** — on peut tout voir mais plus rien créer ni modifier, avec un bandeau « Choisissez une formule ». Aucune donnée n'est supprimée.
- Les limites sont **réellement appliquées** (ex. : impossible de créer le 21ᵉ produit en Essai — message avec bouton « Passer à Pro »).
- En cas de passage à une formule inférieure, les données existantes restent ; seuls les nouveaux ajouts au-delà de la limite sont bloqués.
- **MVP : paiement simulé** — un bouton « Payer (simulation) » active la formule pour 30 jours et enregistre l'opération dans l'historique. Le vrai paiement (Wave / Orange Money, avec vos ressources) remplacera ce bouton en production.

### 3.13 Espace super-administrateur

Accessible uniquement aux adresses email que vous désignez.

- **Chiffres globaux** : nombre de commerces, en essai, payants, expirés ; revenu mensuel estimé.
- **Liste des commerces** avec recherche : nom, propriétaire, téléphone, formule, statut, date de fin d'essai / d'abonnement, nombre de produits et d'employés, date d'inscription.
- **Actions** : changer la formule, prolonger l'essai ou l'abonnement, suspendre / réactiver un commerce (un commerce suspendu ne peut plus accéder à l'application et voit un message l'invitant à vous contacter).

### 3.14 Qualités attendues

- **Design premium**, sobre et moderne (voir § 7), cohérent sur tous les écrans.
- **Mobile d'abord** : utilisable confortablement sur un téléphone d'entrée de gamme, ainsi que sur tablette et ordinateur.
- **Installable sur le téléphone** comme une application (icône sur l'écran d'accueil).
- **Léger et rapide**, utilisable avec une connexion 3G moyenne.
- **Sécurité** : chaque commerce ne voit que ses propres données ; les droits sont vérifiés côté serveur (pas seulement cachés à l'écran) ; mots de passe chiffrés.
- **Compte de démonstration** pré-rempli (produits, ventes, commandes, clients) pour tester tout de suite.

---

## 4. Hors MVP (prévu pour plus tard)

| Fonctionnalité | Quand |
|---|---|
| Vrai paiement de l'abonnement (Wave, Orange Money…) | Passage en production (avec vos ressources) |
| Emails automatiques (mot de passe oublié, invitations, alertes) | Passage en production |
| Import des produits depuis Excel | Juste après le MVP |
| Variantes de produits (taille, couleur) | Version 2 |
| Scan de codes-barres avec la caméra | Version 2 |
| Mode hors-ligne complet avec synchronisation | Version 2 |
| Impression sur imprimante à tickets | Version 2 |
| Envoi WhatsApp / SMS automatique (sans clic) | Version 2 |
| Dettes envers les fournisseurs | Version 2 |
| Restreindre un employé à une seule boutique | Version 2 |
| Catalogue / boutique en ligne publique | Version 2 |
| Export comptable, gestion de la TVA | Version 2 |
| Langue wolof, autres pays et devises | Plus tard |
| Application mobile native (Play Store / App Store) | Plus tard |

### Avant l'ouverture à de vrais clients payants

- brancher le vrai paiement et les emails ;
- créer la clé Google de production et choisir un nom de domaine ;
- rédiger les conditions d'utilisation et la politique de confidentialité (loi sénégalaise sur les données personnelles, CDP) ;
- vérifier la disponibilité de la marque « Sama Stock » (OAPI) ;
- tester avec 3 à 5 commerçants réels.

---

## 5. Parcours utilisateurs

### 5.1 Le patron s'inscrit et démarre

1. Page d'accueil → « Essai gratuit 14 jours ».
2. Inscription par email ou Google.
3. Démarrage guidé : nom du commerce, type d'activité, téléphone, ville.
4. Arrivée sur le tableau de bord vide, avec une liste « Pour bien démarrer » : *ajouter un produit → faire une première vente → inviter un employé*.

### 5.2 Ajouter un produit

Produits → **+ Nouveau produit** → nom, photo, catégorie, unité, prix d'achat, prix de vente, stock de départ, seuil d'alerte → **Enregistrer**. Le stock de départ apparaît dans l'historique comme première entrée.

### 5.3 Recevoir de la marchandise

Stock → **Entrée / Achat** → fournisseur (facultatif) → ajoute les produits, quantités et prix → **Valider**. Le stock augmente, le coût moyen est mis à jour.

### 5.4 Vendre en boutique

**Vendre** (bouton principal, toujours visible) → touche les produits → ajuste les quantités → client (facultatif) → mode de paiement et montant reçu → **Valider** → reçu affiché → **Envoyer sur WhatsApp** → **Nouvelle vente**.

### 5.5 Gérer une commande WhatsApp / Instagram

Commandes → **+ Nouvelle commande** → client (nom, téléphone) → canal → produits → livraison (adresse, frais) → **Enregistrer** (produits réservés) → **Envoyer le récapitulatif sur WhatsApp** → passe en *En préparation* → *En livraison* (le stock sort) → *Livrée* → enregistre le paiement.

### 5.6 Relancer un client qui doit de l'argent

Clients → trie par montant dû → ouvre la fiche → **Rappeler par WhatsApp** → WhatsApp s'ouvre avec le message prêt → plus tard, **Enregistrer un remboursement**.

### 5.7 Être prévenu d'une rupture

Le tableau de bord affiche « 3 produits en stock bas » → clic → liste des produits concernés → **Réapprovisionner** → formulaire d'entrée de stock pré-rempli.

### 5.8 Faire l'inventaire

Stock → **Inventaire** → compte les produits et saisit les quantités → **Valider** → résumé des écarts (ex. « 2 sacs de ciment manquants — 9 000 FCFA ») → écarts enregistrés.

### 5.9 Inviter un employé

Équipe → **Inviter** → nom, email, rôle (Gérant, Vendeur, Magasinier) → **Envoyer le lien par WhatsApp** → l'employé ouvre le lien → crée son compte → arrive dans le commerce avec ses droits.

### 5.10 Passer à une formule payante

Bandeau « Il vous reste 3 jours d'essai » → **Choisir une formule** → compare Pro / Business → **Payer (simulation)** → formule activée, limites mises à jour.

### 5.11 Vous, super-admin

Connexion → menu **Administration** → chiffres globaux → liste des commerces → ouvre un commerce → change sa formule ou prolonge son essai.

---

## 6. Structure des données

Chaque information appartient à un **commerce** : un commerçant ne peut jamais voir les données d'un autre.

```
Utilisateur ──< Membre >── Commerce ──< Boutique / Dépôt
                              │                 │
                              │                 └──< Stock par boutique >── Produit
                              ├──< Catégorie ──< Produit
                              ├──< Invitation
                              ├──< Client ──< Remboursement
                              ├──< Fournisseur
                              ├──< Vente / Commande ──< Ligne de vente
                              ├──< Achat (entrée) ──< Ligne d'achat
                              ├──< Mouvement de stock
                              └──< Historique d'abonnement
```
*(« ──< » signifie « un … possède plusieurs … »)*

| Élément | Informations principales |
|---|---|
| **Utilisateur** | nom, email, mot de passe chiffré ou compte Google, photo |
| **Commerce** | nom, type d'activité, téléphone, adresse, ville, logo, modules actifs (caisse, commandes), **formule** (essai / pro / business), **statut** (essai, actif, expiré, suspendu), date de fin d'essai, date de fin d'abonnement |
| **Membre** | utilisateur, commerce, **rôle** (propriétaire, gérant, vendeur, magasinier) |
| **Invitation** | commerce, nom, email, rôle, code du lien, statut (en attente, acceptée, annulée), date d'expiration |
| **Boutique / Dépôt** | commerce, nom, type (boutique ou dépôt) |
| **Catégorie** | commerce, nom |
| **Produit** | commerce, nom, photo, référence, catégorie, unité, prix d'achat (coût moyen), prix de vente, seuil d'alerte, archivé oui/non |
| **Stock par boutique** | produit, boutique, quantité physique |
| **Mouvement de stock** | commerce, boutique, produit, type (entrée, sortie, vente, commande, retour, ajustement, inventaire, transfert), quantité (+ ou −), motif, document lié (vente, achat, commande…), auteur, date |
| **Fournisseur** | commerce, nom, téléphone, note |
| **Achat (entrée)** | commerce, boutique, fournisseur, date, total, auteur — et ses **lignes** : produit, quantité, prix unitaire |
| **Client** | commerce, nom, téléphone, adresse, note |
| **Vente / Commande** | commerce, boutique, **numéro** (V-0001 pour les ventes, C-0001 pour les commandes), **type** (vente en boutique ou commande en ligne), canal, statut, client, vendeur, sous-total, remise, frais de livraison, total, montant payé, mode de paiement, adresse de livraison, note, dates — et ses **lignes** : produit, nom au moment de la vente, quantité, prix de vente, **coût d'achat au moment de la vente** (pour un bénéfice exact) |
| **Remboursement** | commerce, client, montant, mode de paiement, date, auteur |
| **Historique d'abonnement** | commerce, formule, montant, période couverte, mode (simulation / Wave / Orange Money…), date |

**Règles de calcul clés :**
- *Stock disponible* = quantité physique − quantités des commandes « Nouvelle » ou « En préparation ».
- *Bénéfice* = Σ (prix de vente − coût d'achat au moment de la vente) × quantité, sur les ventes validées et les commandes livrées, moins les remises.
- *Dette d'un client* = Σ (total − payé) de ses ventes et commandes livrées − Σ remboursements.
- *Valeur du stock* = Σ quantité × coût moyen.

---

## 7. Direction visuelle

Définie avec l'outil de design ui-ux-pro-max, adaptée à l'identité de Sama Stock.

| Élément | Choix |
|---|---|
| **Style** | « Bento » épuré : cartes arrondies de tailles variées, beaucoup d'air, ombres très légères, hiérarchie claire. Premium sans être chargé. |
| **Couleur principale** | Vert profond `#0B6E4F` — confiance, argent, sérieux |
| **Couleur d'accent** | Safran `#F59E0B` — boutons importants, alertes « stock bas » (texte foncé dessus pour la lisibilité) |
| **Fond clair** | Blanc cassé chaud `#F7F8F5`, cartes blanches |
| **Fond sombre** | Noir légèrement teinté de vert `#0B1210`, cartes `#121C18` |
| **États** | Vert = en stock / payé, Safran = stock bas / en attente, Rouge `#DC2626` = rupture / dette |
| **Police** | **Plus Jakarta Sans** (moderne, très lisible, gère bien les accents) ; chiffres à largeur fixe pour les montants |
| **Icônes** | Jeu d'icônes unique et cohérent (Lucide) — aucun emoji dans l'interface |
| **Ergonomie** | Boutons d'au moins 44 px, texte d'au moins 16 px sur mobile, barre de navigation en bas sur téléphone, menu latéral sur ordinateur, bouton « Vendre » toujours accessible |
| **Animations** | Discrètes (150–300 ms), respect du réglage « réduire les animations » du téléphone |
| **Accessibilité** | Contraste suffisant en clair et en sombre, champs de formulaire toujours étiquetés, messages d'erreur à côté du champ concerné |

---

## 8. Écrans de l'application

| Zone | Écrans |
|---|---|
| Public | Accueil (avec tarifs), Inscription, Connexion, Accepter une invitation |
| Démarrage | Démarrage guidé |
| Application | Tableau de bord · Vendre (caisse) · Ventes (liste, détail, reçu) · Commandes (liste, nouvelle, détail) · Produits (liste, fiche, nouveau / modifier) · Stock (vue d'ensemble, entrée / achat, sortie / ajustement, inventaire, transfert, historique) · Clients (liste, fiche) · Fournisseurs (liste, fiche) · Rapports · Équipe · Paramètres (commerce, boutiques, modules) · Abonnement |
| Super-admin | Vue d'ensemble · Liste des commerces · Détail d'un commerce |

Navigation mobile (barre du bas) : **Accueil · Vendre · Commandes · Stock · Plus**. Les entrées s'adaptent aux modules actifs et au rôle.

---

## 9. Critères de réussite du MVP (scénarios de test)

Le MVP est considéré comme terminé quand, en local, on peut faire tout ceci sans erreur :

1. Créer un compte, passer le démarrage guidé et arriver sur le tableau de bord.
2. Se connecter au compte de démonstration et voir des données réalistes.
3. Créer un produit avec photo, unité « sac » et seuil d'alerte ; le voir passer en orange quand le stock descend sous le seuil.
4. Enregistrer un achat fournisseur et constater la hausse du stock et le nouveau coût moyen.
5. Faire une vente avec paiement partiel Wave → reçu → bouton WhatsApp ouvrant le bon message → dette visible sur la fiche client.
6. Relancer ce client par WhatsApp, puis enregistrer son remboursement → dette à zéro.
7. Créer une commande Instagram → stock réservé → « En livraison » → stock sorti → « Livrée » et payée.
8. Annuler une commande en préparation → réservation libérée.
9. Faire un inventaire avec un écart → ajustement enregistré et perte affichée.
10. Inviter un Vendeur par lien, se connecter avec son compte → il vend, mais ne voit ni prix d'achat, ni bénéfices, ni rapports, ni équipe.
11. En Essai, être bloqué au 21ᵉ produit ; passer à Pro (simulation) → limite levée ; être bloqué au 4ᵉ employé.
12. Simuler la fin de l'essai → compte en consultation seule.
13. En Business, créer une 2ᵉ boutique et transférer du stock de l'une à l'autre.
14. Se connecter en super-admin → voir les commerces → changer une formule.
15. Utiliser l'application sur téléphone (écran de 375 px de large) en mode clair et sombre.

---

## 10. Annexe technique

*(Pour information — ces choix sont pris en charge par le développement.)*

| Besoin | Choix |
|---|---|
| Application web (écrans + serveur) | **Next.js** (dernière version stable), TypeScript |
| Design | Tailwind CSS + composants shadcn/ui, icônes Lucide, graphiques Recharts |
| Base de données | **Neon** (PostgreSQL en ligne), accès via Drizzle ORM |
| Comptes, Google, équipes et invitations | Better Auth (email / mot de passe, Google, organisations avec rôles) |
| Code source | **GitHub** |
| Mise en ligne | **Vercel** |
| Photos produits | Compressées dans le navigateur et stockées en base (aucun service supplémentaire à configurer) |
| Lancement en local | Je prépare la base Neon et le fichier de configuration ; vous lancez l'application par un **double-clic** sur un fichier `lancer.bat` (installation automatique au premier lancement), puis l'application s'ouvre dans le navigateur |

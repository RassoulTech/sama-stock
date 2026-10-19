# Sama Stock — Guide de lancement et de test

Ce guide explique comment lancer **Sama Stock** sur votre ordinateur et comment le tester, étape par étape. Aucune connaissance technique n'est nécessaire.

---

## 1. Lancer l'application

1. Vérifiez que l'ordinateur est **connecté à internet** (la base de données est en ligne, chez Neon).
2. Ouvrez le dossier du projet et **double-cliquez sur `lancer.bat`**.
3. Une fenêtre noire s'ouvre et affiche les étapes de `[1/4]` à `[4/4]`.
   - Le **premier lancement** prend quelques minutes (installation et préparation).
   - Les lancements suivants prennent quelques secondes.
4. Votre navigateur s'ouvre tout seul sur **http://localhost:3000**. S'il ne s'ouvre pas, tapez cette adresse vous-même.
5. **Laissez la fenêtre noire ouverte** tant que vous utilisez l'application. Pour arrêter : fermez-la.

> Si Windows affiche « Windows a protégé votre ordinateur », cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même**.

### Tester sur votre téléphone

Le téléphone et l'ordinateur doivent être connectés au **même réseau Wi-Fi**.

1. Lancez l'application avec `lancer.bat`.
2. Trouvez l'adresse de votre ordinateur : dans la fenêtre noire, Next.js affiche une ligne `Network: http://192.168.x.x:3000`.
3. Tapez cette adresse dans le navigateur du téléphone.
4. Pour avoir une icône Sama Stock sur l'écran d'accueil, ouvrez le menu du navigateur puis choisissez **Ajouter à l'écran d'accueil**.

Autre solution : sur l'ordinateur, dans Chrome, appuyez sur **F12** puis sur l'icône téléphone pour simuler un écran de mobile.

---

## 2. Les comptes de démonstration

Tous les comptes ont le même mot de passe : **`samastock2026`**

| Email | Rôle | Ce qu'il permet de tester |
|---|---|---|
| `awa@demo.sn` | Propriétaire de **Awa Mode & Beauté** | Tout : formule Business, 2 boutiques, caisse, commandes, crédits, rapports, équipe |
| `fatou@demo.sn` | Gérante chez Awa | Tout sauf l'abonnement, l'équipe et les paramètres |
| `moussa@demo.sn` | Vendeur chez Awa | Ventes et commandes, **sans** prix d'achat ni bénéfices |
| `ibrahima@demo.sn` | Magasinier chez Awa | Entrées, sorties, inventaire, transferts, en quantités seulement |
| `ndiaye@demo.sn` | Propriétaire de **Quincaillerie Ndiaye & Fils** | Formule Essai : 18 produits sur 20, unités sac, mètre et kg |
| `admin@samastock.sn` | Super-administrateur | L'espace d'administration de Sama Stock |

Sur la page de connexion, le bouton **« Essayer le compte de démonstration »** connecte directement avec le compte d'Awa.

Pour remettre les données de démonstration à zéro, ouvrez une fenêtre de commande dans le dossier et tapez :
`npm run db:seed -- --force`

---

## 3. Scénarios de test

Ces 15 scénarios reprennent la section 9 du cahier des charges. Cochez-les au fur et à mesure.

### Inscription et démarrage

- [ ] **1. Créer un compte.** Sur la page d'accueil, cliquez sur **Essai gratuit**. Créez un compte avec un email inventé (ex. `moi@test.sn`), puis remplissez le démarrage guidé. Vous arrivez sur un tableau de bord vide, avec le bandeau « Essai gratuit : 14 jours restants ».
- [ ] **2. Le compte de démonstration.** Déconnectez-vous (menu rond en haut à droite), puis connectez-vous avec `awa@demo.sn`. Le tableau de bord affiche les ventes, le graphique de la semaine, les alertes de stock et les commandes en cours.

### Produits et stock (avec `awa@demo.sn`)

- [ ] **3. Créer un produit.** Allez dans **Produits**, puis **Nouveau produit**. Ajoutez une photo, choisissez l'unité **Sac**, mettez un seuil d'alerte de 5 et un stock de départ de 6. Vendez-en 2 : le produit passe en **orange** (stock bas).
- [ ] **4. Recevoir de la marchandise.** Allez dans **Stock**, puis **Entrée / achat**. Choisissez un produit et saisissez une quantité et un prix d'achat différent du prix actuel. Validez : le stock augmente et le prix d'achat moyen est recalculé (visible sur la fiche produit).

### Ventes et crédits

- [ ] **5. Vente avec paiement partiel.** Allez dans **Vendre**, ajoutez des produits, puis **Encaisser**. Choisissez **Wave** et saisissez un montant inférieur au total. Choisissez un client, ou créez-en un avec un vrai numéro WhatsApp. Validez : le reçu s'affiche. Le bouton **Envoyer sur WhatsApp** ouvre WhatsApp avec le reçu déjà rédigé. La dette apparaît sur la fiche du client.
- [ ] **6. Relancer et encaisser.** Allez dans **Clients** et ouvrez ce client. Cliquez sur **Rappeler par WhatsApp** (le message est prêt), puis sur **Enregistrer un remboursement** : la dette retombe à zéro.

### Commandes en ligne

- [ ] **7. Commande Instagram.** Allez dans **Commandes**, puis **Nouvelle commande**. Choisissez un client, le canal **Instagram**, des produits et des frais de livraison. Sur la fiche produit, la quantité est indiquée comme « réservée ». Passez la commande **En livraison** (le stock sort), puis **Livrée**, puis enregistrez le paiement.
- [ ] **8. Annuler une commande.** Créez une autre commande puis cliquez sur **Annuler la commande** : la réservation est libérée.

### Inventaire et équipe

- [ ] **9. Inventaire.** Allez dans **Stock**, puis **Inventaire**. Saisissez une quantité comptée inférieure à la quantité attendue et validez. Le résumé affiche l'écart et sa valeur en FCFA. La perte apparaît dans **Rapports**.
- [ ] **10. Les droits d'un vendeur.** Déconnectez-vous et connectez-vous avec `moussa@demo.sn`. Le vendeur peut vendre et gérer les commandes, mais ne voit **ni prix d'achat, ni bénéfices, ni rapports, ni équipe**.
  Pour tester une invitation : avec `awa@demo.sn`, allez dans **Équipe**, puis **Inviter un employé**. Copiez le lien, ouvrez-le dans une **fenêtre de navigation privée**, puis créez le compte avec l'email indiqué.

### Abonnements

- [ ] **11. Les limites de formule.** Connectez-vous avec `ndiaye@demo.sn` (formule Essai, 18 produits). Ajoutez 2 produits, puis essayez d'en ajouter un 21ᵉ : un message vous propose de passer à Pro. Allez dans **Abonnement**, puis **Passer à Pro** (simulation) : la limite passe à 50 produits. Dans **Équipe**, vous pouvez désormais inviter 3 employés ; le 4ᵉ est refusé.
- [ ] **12. Fin d'essai.** Connectez-vous avec `admin@samastock.sn`. Dans **Administration**, ouvrez « Quincaillerie Ndiaye & Fils » et cliquez sur **Faire expirer maintenant**. Reconnectez-vous avec `ndiaye@demo.sn` : le compte est en **consultation seule** (bandeau orange, boutons d'ajout masqués).

### Plusieurs boutiques et administration

- [ ] **13. Deux boutiques.** Avec `awa@demo.sn` (formule Business), utilisez le sélecteur **Boutique Médina / Dépôt Liberté 6** en haut de l'écran. Depuis le dépôt, allez dans **Stock**, puis **Transfert**, et envoyez des produits vers la boutique.
- [ ] **14. Super-administrateur.** Avec `admin@samastock.sn`, consultez les chiffres globaux, ouvrez un commerce, changez sa formule ou suspendez-le.
- [ ] **15. Téléphone et mode sombre.** Ouvrez l'application sur un téléphone (voir plus haut) ou en mode mobile (F12). Dans le menu rond en haut à droite, choisissez **Apparence**, puis **Sombre**.

---

## 4. Bon à savoir

- **Connexion avec Google :** le bouton apparaît dès que la clé Google est renseignée dans le fichier `.env` (`GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`). Je vous guiderai pour créer cette clé, qui est gratuite.
- **Paiement de l'abonnement :** il est **simulé** dans cette version. Le vrai paiement par Wave ou Orange Money sera branché au passage en production.
- **Les données** sont enregistrées dans la base Neon du projet `sama-stock` : elles sont conservées entre deux lancements.
- **Après une mise à jour du code**, supprimez le dossier `.next` avant de relancer `lancer.bat`, pour que l'application soit reconstruite.

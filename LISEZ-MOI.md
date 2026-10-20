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

## 2. Votre compte

La plateforme est partie de zéro le 19 octobre 2026, pour n'accueillir que de vraies données.

**Démo publique** (page `/demo`, liens « Démo » sur l'accueil et sur la page de connexion) : le visiteur choisit la formule **Essai**, **Pro** ou **Business** et entre, sans mot de passe, dans une boutique fictive remplie (Quincaillerie Ndiaye & Fils, Ndèye Beauté, Awa Mode & Beauté). Les données sont **recréées chaque jour** ; paiements, invitations et réglages y sont bloqués. Ces boutiques n'apparaissent ni dans les chiffres ni dans les listes de l'administration.

- **Votre accès administrateur** : connectez-vous avec **Google** (adresse `dionemhd1@gmail.com`). C'est la seule adresse autorisée à ouvrir l'espace **Administration**.
- **Pour tester un commerce**, créez-le simplement avec votre compte (page **Essai gratuit**), ou créez un second compte avec une autre adresse.

> ⚠️ Votre ordinateur et le site en ligne utilisent **la même base de données**. Tout ce que vous créez en test apparaît aussi en ligne et dans les chiffres de l'administration. Pour supprimer un commerce de test, demandez-le à votre développeur.

---

## 3. Scénarios de test

Ces scénarios reprennent la section 9 du cahier des charges. Faites-les avec un commerce de test, et cochez-les au fur et à mesure.

### Inscription et démarrage

- [ ] **1. Créer un compte.** Sur la page d'accueil, cliquez sur **Essai gratuit** (ou **Continuer avec Google**), puis remplissez le démarrage guidé. Vous arrivez sur un tableau de bord vide, avec le bandeau « Essai gratuit : 14 jours restants ».
- [ ] **2. Le tableau de bord.** Après quelques ventes (scénarios suivants), il affiche les ventes, le graphique de la semaine, les alertes de stock et les commandes en cours.

### Produits et stock

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
- [ ] **10. Les droits d'un employé.** Dans **Équipe**, cliquez sur **Inviter un employé** avec le rôle **Vendeur**. Copiez le lien, ouvrez-le dans une **fenêtre de navigation privée**, puis créez le compte avec l'email indiqué. Le vendeur peut vendre et gérer les commandes, mais ne voit **ni prix d'achat, ni bénéfices, ni rapports, ni équipe**.

### Abonnements

- [ ] **11. Les limites de formule.** En formule Essai, essayez d'ajouter un 21ᵉ produit : un message vous propose de passer à Pro. Dans l'espace **Administration**, ouvrez votre commerce de test et utilisez **Ajustement manuel** pour le passer en Pro : la limite passe à 50 produits et 3 employés.
- [ ] **12. Fin d'essai.** Dans **Administration**, ouvrez votre commerce de test et cliquez sur **Faire expirer maintenant**. Le compte passe en **consultation seule** (bandeau orange, boutons d'ajout masqués). Réactivez-le ensuite avec **Ajustement manuel**.

### Plusieurs boutiques et administration

- [ ] **13. Deux boutiques.** En formule Business, ajoutez une boutique ou un dépôt dans **Paramètres**, utilisez le sélecteur de boutique en haut de l'écran, puis **Stock → Transfert** pour envoyer des produits d'un lieu à l'autre.
- [ ] **14. Administration.** Avec votre compte Google, ouvrez **Administration** : tableau de bord, commerces, utilisateurs, abonnements, paiements et connexions.
- [ ] **15. Téléphone et mode sombre.** Ouvrez l'application sur un téléphone (voir plus haut) ou en mode mobile (F12). Dans le menu rond en haut à droite, choisissez **Apparence**, puis **Sombre**.

---

## 4. Bon à savoir

- **Le site en ligne :** https://sama-stock-one.vercel.app (mis à jour automatiquement à chaque envoi du code sur GitHub).
- **Connexion avec Google :** active en ligne et sur l'ordinateur (clés `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` du fichier `.env`).
- **Paiement de l'abonnement :** réel, par Wave ou Orange Money via SasPay. Le client paie exactement le prix de la formule ; les frais SasPay sont retirés de votre part. Les paiements en espèces s'enregistrent depuis l'administration (fiche du commerce).
- **Les données** sont enregistrées dans la base Neon du projet `sama-stock`, partagée entre l'ordinateur et le site en ligne.
- **Après une mise à jour du code**, supprimez le dossier `.next` avant de relancer `lancer.bat`, pour que l'application soit reconstruite.

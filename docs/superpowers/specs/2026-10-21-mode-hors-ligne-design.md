# Mode hors ligne — conception

Date : 21 octobre 2026. Statut : en attente de validation.

## Résumé en clair

Pendant une coupure d'internet, le commerçant peut **vendre** et **voir son stock**. Les ventes restent dans le
téléphone et partent toutes seules au retour d'internet. Aucune vente n'est perdue, même si le téléphone s'éteint,
et aucune n'est comptée deux fois. Les autres écrans (commandes, entrées de stock, réglages, rapports) demandent
internet. Tout le monde y a droit, essai gratuit compris.

## Décisions validées

| Sujet | Décision |
|---|---|
| Ce qui marche sans internet | La caisse (vendre, reçu, envoi WhatsApp) et la consultation du stock. |
| Qui y a droit | Toutes les formules : essai, Pro, Business et licences. |
| Méthode | Un service worker écrit sur mesure, un stockage local (IndexedDB) et une adresse d'envoi dédiée. |
| Vente qui rend le stock négatif | Acceptée (l'argent est encaissé), signalée « À vérifier » au propriétaire. |
| Prix modifié entre-temps | On garde le prix montré au client, avec une mention « prix différent ». |
| Nouveau client pendant une coupure | Impossible : il faut internet. Le crédit se fait avec un client déjà enregistré. |
| Déconnexion avec des ventes en attente | L'application prévient. Les ventes restent dans le téléphone et partent à la prochaine connexion du même utilisateur. |

### Pourquoi pas les autres méthodes

- **Serwist** (outil tout fait) : il ajoute une dépendance à l'outil de construction. Sa compatibilité avec Next.js 16.4 et
  Turbopack n'est pas garantie. Notre besoin, une page de secours et ses fichiers, tient en un petit service worker.
- **`experimental.useOffline` de Next.js** : il ne couvre que les coupures courtes. Les requêtes en attente sont perdues
  si l'application se ferme, et l'application ne s'ouvre pas sans réseau. Il **ne doit pas** être activé : il garde une
  Server Action en attente au lieu de la faire échouer, ce qui empêcherait la caisse de basculer vers la file
  d'attente locale.

## Ce que voit le commerçant

1. **Préparation automatique** : à chaque ouverture de l'application avec internet, le téléphone garde une copie de la
   caisse, des produits, des prix, du stock et des clients. Il faut avoir ouvert l'application au moins une fois avec
   internet depuis cette mise à jour.
2. **Pendant une coupure** :
   - Un bandeau orange s'affiche : « Pas d'internet : vous pouvez continuer à vendre », avec un lien « Ouvrir la caisse ».
   - La caisse marche comme d'habitude.
   - Le reçu porte un numéro provisoire (« Hors ligne n° 3 »). Le bouton WhatsApp reste utilisable : WhatsApp garde le
     message jusqu'au retour du réseau.
   - L'onglet **Stock** liste les produits avec la quantité restante, ventes en attente déjà déduites. Il indique aussi
     « Stock mis à jour il y a 2 h ».
   - Un compteur affiche « 3 ventes en attente d'envoi ».
   - Les autres écrans affichent « Cette page a besoin d'internet », avec un bouton vers la caisse.
3. **Au retour d'internet** : les ventes partent seules. Le bandeau devient vert (« 3 ventes envoyées »). Chaque vente
   garde son heure réelle et reçoit son vrai numéro (V-0124).
4. **Côté propriétaire** :
   - Dans la liste des ventes, un badge « Hors ligne » marque les ventes faites pendant une coupure.
   - Sur le reçu, une alerte explique un éventuel problème : stock devenu négatif, prix différent ou client introuvable.
   - Sur le tableau de bord, une carte « À vérifier » apparaît s'il y a de telles ventes depuis 7 jours.

## Architecture

### Vue d'ensemble

```
Téléphone                                              Serveur (Vercel)
┌────────────────────────────┐   GET  /api/hors-ligne/catalogue   ┌───────────────────────┐
│ OfflineProvider (layout)   │ ─────────────────────────────────▶ │ catalogue (contexte    │
│  • télécharge le catalogue │                                     │ courant, sans coûts)   │
│  • envoie la file d'attente│   POST /api/hors-ligne/ventes      │ recordOfflineSale()    │
│                            │ ─────────────────────────────────▶ │  • idempotent (client_ref)
│ IndexedDB « sama-stock »   │                                     │  • stock négatif permis │
│  • snapshot  • outbox      │                                     │  • signalements         │
│                            │                                     └───────────────────────┘
│ Service worker /sw.js      │
│  • fichiers /_next/static  │
│  • page /hors-ligne        │
└────────────────────────────┘
```

### 1. Service worker — `public/sw.js`

Écrit à la main, sans dépendance. Portée `/`. Enregistré par `OfflineProvider`, en production uniquement.

- **Fichiers statiques** (`/_next/static/*`, icônes, `manifest.webmanifest`) : d'abord le cache, sinon le réseau. Ce
  sont des fichiers à nom unique, ils ne changent jamais.
- **Navigations** (requêtes `mode: "navigate"`) : d'abord le réseau. En cas d'échec réseau, on renvoie la page
  `/hors-ligne` gardée en cache. Si elle n'est pas en cache, on renvoie une petite page de texte : « Pas d'internet.
  Ouvrez Sama Stock une fois avec internet pour préparer le mode hors ligne. »
- **Pré-chargement de la page de secours** : sur le message `{ type: "precache", version }` envoyé par
  `OfflineProvider`, le service worker :
  1. télécharge `/hors-ligne` ;
  2. relève dans son HTML toutes les adresses `/_next/static/...` (scripts, feuilles de style, polices) et les met en
     cache ;
  3. range le tout dans `sama-offline-<version>` et supprime les anciens caches `sama-offline-*`.

  La `version` est l'identifiant du déploiement (`NEXT_PUBLIC_BUILD_ID`, fixé dans `next.config.ts` depuis
  `VERCEL_GIT_COMMIT_SHA`, ou `local` en développement). Le pré-chargement n'est refait que si la version change.
- **Jamais mis en cache** : `/api/*`, les requêtes POST (Server Actions), les requêtes RSC des autres pages et
  l'authentification.
- **En-têtes** (dans `next.config.ts`) : `/sw.js` est servi avec `Cache-Control: no-cache, no-store, must-revalidate`
  et `Service-Worker-Allowed: /`.
- **Liens internes pendant une coupure** : si le routeur de Next.js ne bascule pas de lui-même vers une navigation
  complète, le bandeau propose un vrai lien `<a href="/hors-ligne">`. Ce lien passe toujours par le service worker.

### 2. Page de secours — `src/app/hors-ligne/page.tsx`

- Page statique : aucune donnée serveur, aucune vérification de session au rendu. Les données viennent
  d'IndexedDB, sur le téléphone d'un utilisateur déjà connecté. Elle n'est pas dans `PROTECTED_PREFIXES` et elle est
  marquée `NO_INDEX`.
- Affiche le client `OfflineApp`, avec trois onglets : **Caisse**, **Stock** et **En attente**.
- Sans copie locale : « Ouvrez Sama Stock une fois avec internet pour préparer le mode hors ligne. »
- La caisse est cachée dans ces cas :
  - la copie indique que la caisse est désactivée ;
  - l'utilisateur n'a pas la permission `sales.create` ;
  - le commerce est en lecture seule ;
  - la date limite de vente est dépassée, même sans réseau (on compare `plan.sellUntil` à l'heure du téléphone).
    `sellUntil` vaut la fin de l'essai ou de l'abonnement, et `null` pour une licence, qui n'expire jamais (sa date de
    fin est celle de la maintenance, qui ne bloque pas la caisse).

  L'onglet Stock reste visible si l'utilisateur a `products.view`.
- Avec internet, la page affiche en plus « Revenir à l'application ».
- Pas d'import dynamique (`dynamic()`) dans cette page : tous ses fichiers doivent figurer dans son HTML pour le
  pré-chargement.

### 3. Stockage local — `src/lib/offline/`

Base IndexedDB `sama-stock`, version 1, petit utilitaire maison à base de promesses (`db.ts`), sans dépendance.

- **`snapshot`** : un seul enregistrement, sous la clé `current`.

  ```ts
  type OfflineSnapshot = {
    version: 1;
    savedAt: string;                       // ISO
    user: { id: string; name: string };
    business: { id: string; name: string; logo: string | null; address: string | null; city: string | null; phone: string | null; brandColor: string | null; licensed: boolean };
    location: { id: string; name: string };
    can: { sell: boolean; viewStock: boolean };
    plan: { readOnly: boolean; sellUntil: string | null; label: string };   // sellUntil null = licence, sans limite
    modulePos: boolean;
    products: { id: string; name: string; unit: string; salePrice: number; available: number; alertThreshold: number; categoryId: string | null }[];
    categories: { id: string; name: string }[];
    customers: { id: string; name: string; phone: string | null }[];
  };
  ```

  Il n'y a jamais de prix d'achat ni de bénéfice dans la copie. Les photos des produits ne sont pas gardées : sans
  internet, la vignette affiche les initiales. Le logo (data URL) est gardé.

- **`outbox`** : clé `clientRef` (UUID créé sur le téléphone avec `crypto.randomUUID()`).

  ```ts
  type OutboxSale = {
    clientRef: string;
    userId: string; businessId: string; locationId: string;
    createdAt: string;                     // heure du téléphone au moment de la vente
    localNumber: number;                   // « Hors ligne n° 3 »
    items: { productId: string; name: string; unit: string; quantity: number; unitPrice: number }[];
    discount: number; paymentMethod: SaleMethod; amountReceived: number;
    customerId: string | null; customerName: string | null;
    status: "pending" | "refused" | "sent";
    error: string | null; attempts: number;
    serverId: string | null; serverNumber: string | null; sentAt: string | null;
  };
  ```

  Une vente envoyée passe en `sent` et reste affichée dans « En attente » (section « Envoyées ») pendant 24 h, puis
  elle est effacée. Une vente n'est jamais effacée avant d'avoir été acceptée par le serveur, sauf si l'utilisateur
  retire lui-même une vente refusée, après confirmation.

- **`meta`** : compteur des numéros provisoires (`localCounter`).
- **Fonctions pures testées** (`stock.ts`, `sale.ts`) :
  - `localAvailability(products, outbox, locationId)` : disponible = disponible de la copie − quantités des ventes
    `pending` de ce lieu ;
  - `buildOutboxSale(...)` : calcule les lignes et les totaux de la même façon que le serveur (arrondis compris) ;
  - `outboxSummary(outbox, userId)` : compteurs pour le bandeau.

### 4. Téléchargement de la copie — `GET /api/hors-ligne/catalogue`

- `src/app/api/hors-ligne/catalogue/route.ts`, avec `getContext()` (commerce et lieu courants, selon les cookies).
  Répond 401 sans session.
- Renvoie un `OfflineSnapshot` construit par `src/server/queries/offline.ts` à partir de :
  - `listProducts(ctx)`, avec un disponible qui tient déjà compte des réservations des commandes ;
  - `listCategories` ;
  - `customerOptions`.
- `Cache-Control: no-store`.
- Appelé par `OfflineProvider` dans ces cas :
  - au chargement de l'application ;
  - à l'événement `online` ;
  - après chaque vente réussie ;
  - à l'ouverture de `/vendre`.

  Au plus une fois toutes les 2 minutes, sauf après une vente. Un changement de commerce ou de boutique remplace la
  copie, jamais la file d'attente.

### 5. Envoi des ventes — `POST /api/hors-ligne/ventes`

On utilise une adresse dédiée et non une Server Action, car l'identifiant d'une Server Action change à chaque mise en
ligne. Une vente gardée par une ancienne version de l'application doit rester envoyable. Le format est donc versionné :

```
Requête : { version: 1, sales: OfflineSaleInput[] }   // 1 à 50 ventes, validées par zod
Réponse : { results: ({ clientRef, status: "ok", id, number }
                     | { clientRef, status: "refused", error }
                     | { clientRef, status: "retry", error })[] }
```

401 si la session a expiré. Le téléphone garde alors tout et affiche « Reconnectez-vous pour envoyer 3 ventes ».

Service `src/server/services/offline-sales.ts` → `recordOfflineSale(userId, input)`. Chaque vente a sa propre
transaction : une vente refusée ne bloque pas les autres.

1. **Commerce** : contexte reconstruit pour `input.businessId` à partir des adhésions de l'utilisateur, sans passer par
   le cookie. L'utilisateur a pu changer de commerce depuis la vente. Nouvelle fonction
   `contextForBusiness(userId, businessId, locationId)` dans `src/server/context.ts`.
   - Il faut la permission `sales.create`, une caisse activée, et un lieu qui appartient bien au commerce. Sinon :
     `refused`.
   - Commerce suspendu : `retry`, avec le message « Commerce suspendu ».
2. **Formule** : si le commerce est en lecture seule (abonnement ou essai expiré), la vente est acceptée seulement si
   `createdAt <= plan.endsAt`, c'est-à-dire faite pendant que la formule était valide. Une licence n'est jamais en
   lecture seule, sauf suspension (cas précédent). Sinon : `refused` (« Formule
   expirée au moment de la vente »).
3. **Doublon** : nouvelle colonne `sales.client_ref`, avec un index unique `(business_id, client_ref)` quand elle est
   remplie. Si la vente existe déjà, on renvoie `ok` avec son `id` et son `number`. Un double envoi n'a donc aucun
   effet.
4. **Date** : on garde `createdAt` (heure du téléphone). Si elle est dans le futur de plus de 5 minutes, on la ramène à
   maintenant. Si elle est antérieure à la création du commerce, on la ramène à la date de création du commerce.
   `completedAt = createdAt`.
5. **Lignes** :
   - Les produits doivent appartenir au commerce. Un produit archivé entre-temps reste accepté.
   - On vérifie les unités entières, comme pour une vente en ligne.
   - Le prix unitaire est celui envoyé par le téléphone (le prix montré au client). On ajoute le signalement
     `prix_modifie` s'il diffère du prix actuel.
   - Le coût unitaire est le coût actuel lu sur le serveur.
   - Le total est recalculé sur le serveur.
   - Une remise supérieure au sous-total entraîne un refus (ce cas ne peut venir que d'une erreur).
6. **Client** :
   - Il doit appartenir au commerce.
   - S'il a été supprimé entre-temps, on retire le client et on ajoute le signalement `client_introuvable`. La vente
     est quand même acceptée.
   - La règle « crédit ⇒ client obligatoire » ne fait pas refuser une vente déjà faite : on la signale.
7. **Stock** : on garde `lockStock` pour l'ordre des opérations, sans vérification de disponibilité. On applique
   `applyStockMovement` normalement. Si le disponible (stock physique moins les commandes réservées) devient négatif,
   on ajoute le signalement `stock_negatif` (affiché « Stock insuffisant »).
8. **Numéro** : `nextNumber(tx, businessId, "sale")`, attribué au moment de l'envoi.
9. **Colonnes ajoutées** (migration `0006_hors_ligne`) :
   - `client_ref text` ;
   - `offline_synced_at timestamptz` (rempli = vente faite hors ligne) ;
   - `sync_flags text[] not null default '{}'`.

   Le calcul des signalements est une fonction pure testée (`computeSyncFlags`).

### 6. Moteur d'envoi — `src/lib/offline/sync.ts` et `src/components/offline/offline-provider.tsx`

- `OfflineProvider` est monté dans `(app)/layout.tsx` et dans `/hors-ligne`. Il fournit un contexte React :
  `online`, `pendingCount`, `refusedCount`, `lastSync`, `sessionExpired`, `snapshot`, `enqueueSale()`.
- **Déclencheurs d'envoi** :
  - le chargement ;
  - l'événement `online` ;
  - une nouvelle vente mise en file ;
  - toutes les 30 secondes tant qu'il reste des ventes `pending`.
- Seules les ventes de l'utilisateur connecté (`userId` de la copie) sont envoyées. Les ventes d'un autre utilisateur
  du même téléphone attendent sa connexion.
- `navigator.locks.request("sama-stock-sync")` empêche deux onglets d'envoyer en même temps. S'il n'est pas
  disponible, l'idempotence du serveur suffit.
- **Erreur réseau** : la vente reste `pending`, `attempts++`. **401** : `sessionExpired = true`, et l'envoi s'arrête
  jusqu'au prochain chargement. **`refused`** : la vente passe en `refused`, avec le message affiché.
- Au premier chargement, l'application demande `navigator.storage.persist()` pour que le navigateur n'efface pas les
  données.

### 7. Caisse — une seule caisse pour les deux modes

- `PosScreen` reçoit une fonction `submit(payload)` au lieu d'appeler directement `createSale`. Les pages appellent
  `usePosSubmit()`, qui fournit cette fonction.
  - **En ligne** (`/vendre`) : on appelle `createSale`.
    - Si l'appel échoue faute de réseau (la promesse est rejetée, sans réponse du serveur), la vente est mise en file
      et le reçu provisoire s'affiche.
    - Si le serveur répond par une erreur (`ok: false`), l'erreur s'affiche comme aujourd'hui.
  - **Hors ligne** (`/hors-ligne`) : la vente est mise en file directement.
- `createSale` reçoit un `clientRef` généré par le téléphone et applique la même règle anti-doublon que l'envoi
  hors ligne. Si une vente avec ce `clientRef` existe déjà, son `id` est renvoyé sans rien recréer.
- Sur `/vendre`, le disponible affiché retire aussi les ventes encore en file (`localAvailability`). Le stock reste
  ainsi juste juste après une coupure. Après un envoi réussi, la page se rafraîchit (`router.refresh()`) pour
  reprendre le stock du serveur.
- **Reçu provisoire** : `OfflineReceipt` réutilise `Receipt`. `Receipt` reçoit désormais un type réduit `ReceiptData`
  (numéro, date, lignes, totaux, vendeur, client, commerce), auquel `SaleDetail` + `Business` correspondent toujours.
  Le numéro affiché est « Hors ligne n° X ». WhatsApp : même message `receiptMessage`, avec ce numéro. Impression :
  `window.print()`, qui marche sans réseau.
- `CustomerCombobox` reçoit `allowCreate={false}` sans réseau : le bouton « Nouveau client » est caché et remplacé par
  la mention « Il faut internet pour créer un client ».

### 8. Bandeau — `src/components/offline/offline-banner.tsx`

Affiché sous l'en-tête de `(app)/layout.tsx` et en haut de `/hors-ligne`. Un seul état est affiché à la fois, dans
cet ordre de priorité :

1. Session expirée avec des ventes en attente : « Reconnectez-vous pour envoyer N ventes ».
2. Pas d'internet : « Pas d'internet : vous pouvez continuer à vendre », avec un lien « Ouvrir la caisse » hors de la
   caisse.
3. Ventes refusées : « N ventes n'ont pas pu être envoyées », avec un lien vers l'onglet En attente.
4. Ventes en attente avec internet : « Envoi de N ventes… ».
5. Envoi réussi : « N ventes envoyées », en vert, pendant 5 secondes.

### 9. Déconnexion

`UserMenu`, `SignOutButton` et `DemoSignupButton` passent par une fonction commune `signOutSafely()`. S'il reste des
ventes `pending` ou `refused`, une confirmation apparaît : « 3 ventes ne sont pas encore envoyées. Elles resteront
dans ce téléphone et partiront à votre prochaine connexion. » À la déconnexion, la copie (`snapshot`) est effacée. La
file d'attente est conservée.

### 10. Côté propriétaire

- `/ventes` : badge « Hors ligne » quand `offline_synced_at` est rempli, et filtre « À vérifier » (`sync_flags` non
  vide).
- `/ventes/[id]` : encadré qui explique chaque signalement, avec un lien vers le stock du produit pour
  `stock_negatif`.
- Tableau de bord (droit `dashboard.full`) : carte « À vérifier » s'il y a des ventes signalées depuis 7 jours, avec un
  lien vers le filtre.

## Erreurs et cas limites

| Cas | Comportement |
|---|---|
| Coupure au moment de valider sur `/vendre` | La vente est mise en file, avec un reçu provisoire. Aucune double vente : le serveur n'a rien reçu, ou la reprise est idempotente. |
| Le serveur a enregistré la vente, mais la réponse s'est perdue | La vente est déjà en base. L'envoi suivant de la file renvoie `ok` grâce à `client_ref`. Ce cas suppose que la vente en ligne ait aussi un `client_ref` : `createSale` reçoit désormais un `clientRef` généré par le téléphone. |
| Deux téléphones vendent le dernier article | Les deux ventes sont acceptées, le stock devient négatif et la vente est signalée `stock_negatif`. |
| Téléphone éteint ou application fermée pendant la coupure | La file est dans IndexedDB : elle part au prochain lancement. |
| Mise à jour de l'application pendant la coupure | Le nouveau service worker s'installe au retour du réseau. Le format d'envoi versionné reste accepté. |
| Changement de commerce ou de boutique | La copie est remplacée. Les ventes en file gardent leur commerce et leur lieu d'origine. |
| Deux utilisateurs sur le même téléphone | Chaque vente porte son `userId`. Seules celles de l'utilisateur connecté partent. |
| Navigateur qui efface les données (iPhone sans icône installée) | Limité par `storage.persist()` et l'installation de l'icône (déjà faite lors de l'installation chez le client). |
| Copie très ancienne | « Stock mis à jour il y a 3 jours » s'affiche, en orange au-delà de 24 h. |
| Heure du téléphone fausse | La date est ramenée dans un intervalle raisonnable (point 5.4). |

## Tests

- **Tests unitaires (vitest)** :
  - `localAvailability` ;
  - `buildOutboxSale` (totaux identiques au serveur, arrondis des quantités décimales) ;
  - `outboxSummary` ;
  - `computeSyncFlags` ;
  - le recalage des dates ;
  - le schéma zod de `OfflineSaleInput` (refus des formats invalides, maximum 50 ventes).
- **Parcours complet (Playwright, `next build && next start` en local, compte démo Pro)** :
  1. Ouvrir `/vendre` avec internet : la copie est enregistrée et le service worker est actif.
  2. `context.setOffline(true)`, puis recharger : la page de secours s'affiche avec les produits.
  3. Faire une vente : le reçu provisoire s'affiche et le stock affiché baisse.
  4. Recharger, toujours hors ligne : la vente est toujours en file.
  5. `setOffline(false)` : la vente est envoyée. Elle apparaît dans `/ventes` avec un vrai numéro et le badge « Hors
     ligne », et le stock du serveur a baissé.
  6. Renvoyer la même vente à l'adresse d'envoi : pas de doublon.
  7. Vendre hors ligne plus que le stock : signalement `stock_negatif` visible sur le reçu et le tableau de bord.
  8. Couper le réseau juste avant « Valider la vente » sur `/vendre` : la vente bascule en file.
- **Vérifications** : `tsc`, `eslint`, `vitest`, `npm run build`. Le service worker est servi avec les bons en-têtes.
  Après la mise en ligne, le même parcours est refait sur le site en ligne avec le compte démo.

## Hors périmètre (plus tard, si besoin)

- Sans internet : commandes, entrées de stock, remboursements de crédit, création de clients et rapports.
- Photos des produits.
- Envoi en arrière-plan quand l'application est fermée (API Background Sync, absente sur iPhone).

## Fichiers touchés

- **Nouveaux** :
  - `public/sw.js`
  - `src/app/hors-ligne/page.tsx`
  - `src/app/api/hors-ligne/catalogue/route.ts`
  - `src/app/api/hors-ligne/ventes/route.ts`
  - `src/lib/offline/{db,stock,sale,sync,types}.ts`, avec leurs tests
  - `src/server/queries/offline.ts`
  - `src/server/services/offline-sales.ts`
  - `src/components/offline/{offline-provider,offline-banner,offline-app,offline-receipt,use-pos-submit}.tsx`
  - `drizzle/0006_hors_ligne.sql`
- **Modifiés** :
  - `next.config.ts` (en-têtes de `/sw.js`, `NEXT_PUBLIC_BUILD_ID`)
  - `src/db/schema/app.ts` (colonnes `sales`)
  - `src/server/context.ts` (`contextForBusiness`)
  - `src/server/actions/sales.ts` (`clientRef`)
  - `src/components/pos/pos-screen.tsx` et `checkout-dialog.tsx`
  - `src/components/customers/customer-combobox.tsx`
  - `src/components/sales/receipt.tsx`
  - `src/app/(app)/layout.tsx`
  - `src/app/(app)/vendre/page.tsx`
  - `src/app/(app)/ventes/page.tsx` et `ventes/[id]/page.tsx`
  - `src/app/(app)/tableau-de-bord/page.tsx`
  - `src/components/shell/user-menu.tsx` et `sign-out-button.tsx`
  - `src/components/demo/demo-signup-button.tsx`
  - `src/server/queries/sales.ts` (filtre « À vérifier »)
